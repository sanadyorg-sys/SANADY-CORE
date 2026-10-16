import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildZip, crc32 } from "@/server/zip";

/** Reads back the entries of a stored (uncompressed) ZIP. */
function readZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: Array<{ name: string; data: string; crc: number }> = [];
  let p = 0;
  while (view.getUint32(p, true) === 0x04034b50) {
    const crc = view.getUint32(p + 14, true);
    const size = view.getUint32(p + 18, true);
    const nameLen = view.getUint16(p + 26, true);
    const name = new TextDecoder().decode(bytes.slice(p + 30, p + 30 + nameLen));
    const data = new TextDecoder().decode(bytes.slice(p + 30 + nameLen, p + 30 + nameLen + size));
    out.push({ name, data, crc });
    p += 30 + nameLen + size;
  }
  return { entries: out, endSignature: view.getUint32(bytes.length - 22, true), count: view.getUint16(bytes.length - 12, true) };
}

describe("ZIP writer", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("writes readable entries with UTF-8 names and a valid directory", () => {
    const zip = buildZip([
      { name: "LISEZMOI.txt", data: "Bonjour" },
      { name: "évaluations.csv", data: "﻿Nom;Score\r\nAmina;80\r\n" },
    ]);
    const r = readZip(zip);
    expect(r.entries.map((e) => e.name)).toEqual(["LISEZMOI.txt", "évaluations.csv"]);
    expect(r.entries[1]!.data).toContain("Amina;80");
    expect(r.entries[0]!.crc).toBe(crc32(new TextEncoder().encode("Bonjour")));
    expect(r.endSignature).toBe(0x06054b50);
    expect(r.count).toBe(2);
  });
});
