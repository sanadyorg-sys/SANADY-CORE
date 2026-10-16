-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Partenariats & Coopération — communication templates (brief V2 §14)
--
-- Reusable messages for partner relations, with placeholders filled in for
-- one organisation and one contact. A person always reviews and sends each
-- message, one at a time (copy, own e-mail software, partner portal, or the
-- platform's e-mail once configured): nothing is sent automatically, and
-- no marketing e-mail goes out without permission. Each message sent is
-- written to the organisation's notes (contact history).
-- The starter templates hold generic wording only — no figure, commitment
-- or fact about the Foundation beyond what the team writes in.
-- ════════════════════════════════════════════════════════════════════════════

create table public.partnership_templates (
  id           uuid primary key default gen_random_uuid(),
  category     text not null check (category in ('first_contact', 'acknowledgement', 'follow_up', 'decline', 'renewal', 'report', 'thanks', 'other')),
  title        text not null check (char_length(btrim(title)) between 3 and 120),
  subject      text not null check (char_length(btrim(subject)) between 3 and 200),
  body         text not null check (char_length(btrim(body)) between 10 and 6000),
  archived_at  timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index partnership_templates_category_idx on public.partnership_templates (category) where archived_at is null;

alter table public.partnership_templates enable row level security;
revoke all on public.partnership_templates from anon, authenticated;
create policy partnership_templates_select on public.partnership_templates for select to authenticated using (private.is_partnership_staff());
grant select on public.partnership_templates to authenticated;

create function public.save_partnership_template(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  if v_id is null then
    insert into public.partnership_templates (category, title, subject, body, created_by, updated_by)
    values (p ->> 'category', btrim(p ->> 'title'), btrim(p ->> 'subject'), btrim(p ->> 'body'), auth.uid(), auth.uid())
    returning id into v_id;
  else
    update public.partnership_templates
       set category = p ->> 'category', title = btrim(p ->> 'title'), subject = btrim(p ->> 'subject'), body = btrim(p ->> 'body'),
           updated_by = auth.uid(), updated_at = now()
     where id = v_id;
    perform private.require(found, 'not_found');
  end if;
  return v_id;
end;
$$;

create function public.set_partnership_template_archived(p_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  update public.partnership_templates set archived_at = case when p_archived then now() end, updated_by = auth.uid(), updated_at = now() where id = p_id;
  perform private.require(found, 'not_found');
end;
$$;

-- Contact history: what was sent, to whom, how — written by the person who sent it.
create function public.record_partner_communication(p_org uuid, p_contact uuid, p_channel text, p_subject text, p_body text, p_template uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to    text;
  v_label text;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  perform private.require(p_channel in ('email', 'portal', 'copy'), 'invalid_input');
  perform private.require(char_length(btrim(coalesce(p_subject, ''))) between 1 and 200 and char_length(btrim(coalesce(p_body, ''))) between 1 and 6000, 'invalid_input');
  perform private.require(exists (select 1 from public.partner_organizations where id = p_org and status is not null), 'not_found');
  select full_name into v_to from public.partner_contacts where id = p_contact and organization_id = p_org;
  perform private.require(p_contact is null or v_to is not null, 'invalid_input');
  v_label := case p_channel when 'email' then 'E-mail envoyé' when 'portal' then 'Message de l’espace partenaire' else 'Message préparé (envoyé hors plateforme)' end;
  if p_channel = 'portal' then
    perform public.post_partner_message(p_org, btrim(p_body));
  end if;
  insert into public.partnership_notes (organization_id, body, author_id)
  values (p_org, left(v_label || coalesce(' à ' || v_to, '') || ' — ' || btrim(p_subject) || E'\n\n' || btrim(p_body), 4000), auth.uid());
  perform private.log_audit('partner_communication', 'partner_organizations', p_org, null,
                            jsonb_build_object('channel', p_channel, 'template', p_template));
end;
$$;

revoke execute on function
  public.save_partnership_template(uuid, jsonb), public.set_partnership_template_archived(uuid, boolean),
  public.record_partner_communication(uuid, uuid, text, text, text, uuid)
from public, anon;
grant execute on function
  public.save_partnership_template(uuid, jsonb), public.set_partnership_template_archived(uuid, boolean),
  public.record_partner_communication(uuid, uuid, text, text, text, uuid)
to authenticated;

-- ─── Starter templates (generic wording, to adapt) ─────────────────────────
-- Placeholders: {{organisation}}, {{contact}}, {{interlocuteur}}, {{reference}}, {{date}}.
insert into public.partnership_templates (category, title, subject, body) values
('first_contact', 'Premier contact', 'Fondation Sanady — échange sur un partenariat avec {{organisation}}',
'Bonjour {{contact}},

Je me permets de vous contacter au nom de la Fondation Sanady. Nous aimerions échanger avec {{organisation}} sur une possible coopération autour de nos programmes éducatifs.

Seriez-vous disponible pour un premier échange dans les prochaines semaines ? Je vous propose de convenir ensemble d’un créneau.

Bien cordialement,
{{interlocuteur}}
Fondation Sanady'),
('acknowledgement', 'Accusé de réception d’une candidature', 'Votre proposition de partenariat {{reference}}',
'Bonjour {{contact}},

Nous vous remercions pour la proposition de partenariat transmise par {{organisation}} (référence {{reference}}).

Notre équipe l’étudie et reviendra vers vous dès que possible. N’hésitez pas à nous écrire si vous souhaitez compléter votre dossier.

Bien cordialement,
{{interlocuteur}}
Fondation Sanady'),
('follow_up', 'Relance', 'Suite de notre échange — {{organisation}}',
'Bonjour {{contact}},

Je reviens vers vous à la suite de notre dernier échange. Avez-vous pu avancer de votre côté ?

Je reste disponible pour en parler à votre convenance.

Bien cordialement,
{{interlocuteur}}
Fondation Sanady'),
('decline', 'Réponse négative', 'Votre proposition {{reference}}',
'Bonjour {{contact}},

Nous vous remercions sincèrement de l’intérêt que {{organisation}} porte à la Fondation Sanady.

Après étude, nous ne sommes pas en mesure de donner suite à cette proposition pour le moment. Nous serions heureux de rester en contact pour de futures occasions de coopération.

Bien cordialement,
{{interlocuteur}}
Fondation Sanady'),
('renewal', 'Proposition de renouvellement', 'Renouvellement de notre convention {{reference}}',
'Bonjour {{contact}},

Notre convention {{reference}} avec {{organisation}} arrive prochainement à son terme.

Nous souhaiterions échanger avec vous sur la suite de notre coopération et les conditions d’un éventuel renouvellement. Pouvons-nous convenir d’un rendez-vous ?

Bien cordialement,
{{interlocuteur}}
Fondation Sanady'),
('report', 'Transmission d’un rapport', 'Rapport de notre partenariat — {{organisation}}',
'Bonjour {{contact}},

Vous trouverez ci-joint le rapport consacré à notre partenariat avec {{organisation}} (référence {{reference}}).

Il présente les activités réalisées et les indicateurs vérifiés par la Fondation. Nous restons à votre disposition pour en discuter.

Bien cordialement,
{{interlocuteur}}
Fondation Sanady'),
('thanks', 'Remerciements', 'Merci de votre soutien',
'Bonjour {{contact}},

Au nom de la Fondation Sanady, je tiens à remercier {{organisation}} pour sa contribution.

Nous vous tiendrons informés des activités menées grâce à votre soutien.

Bien cordialement,
{{interlocuteur}}
Fondation Sanady');
