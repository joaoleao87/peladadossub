import { describe, expect, it } from "vitest";
import type { PlayerCardData } from "./database.types";
import { calculatePlayerCardOverall, cardStats, playerCardStatus } from "./playerCard";

const complete: PlayerCardData = {
  player_id: "player", display_name: "João", position: "ALA", overall: 87,
  pace: 91, shooting: 84, passing: 89, dribbling: 88, defending: 72,
  physical: 86, card_type: "normal", photo_url: null, photo_scale: 1,
  photo_position_x: 0, photo_position_y: 0,
};

describe("status da cartinha", () => {
  it("não inventa dados quando não existe configuração", () => {
    expect(playerCardStatus(null)).toBe("not_configured");
  });
  it("diferencia configuração incompleta de pronta", () => {
    expect(playerCardStatus({ ...complete, defending: null })).toBe("incomplete");
    expect(playerCardStatus(complete)).toBe("ready");
  });
  it("não exige foto para considerar os atributos prontos", () => {
    expect(complete.photo_url).toBeNull();
    expect(playerCardStatus(complete)).toBe("ready");
  });
});

describe("overall automático", () => {
  it("aplica pesos diferentes conforme a posição", () => {
    const attributes = { pace: 95, shooting: 90, passing: 80, dribbling: 85, defending: 35, physical: 75 };
    expect(calculatePlayerCardOverall({ ...attributes, position: "PIVO" })).toBe(83);
    expect(calculatePlayerCardOverall({ ...attributes, position: "FIXO" })).toBe(66);
  });

  it("usa os seis atributos específicos para goleiro", () => {
    const goalkeeper = { position: "GOL" as const, pace: 88, shooting: 85, passing: 88, dribbling: 90, defending: 38, physical: 88 };
    expect(calculatePlayerCardOverall(goalkeeper)).toBe(84);
    expect(cardStats("GOL").map(([, label]) => label)).toEqual(["DIV", "HAN", "KIC", "REF", "SPE", "POS"]);
  });

  it("só calcula quando posição e todos os atributos existem", () => {
    expect(calculatePlayerCardOverall({ position: "ALA", pace: 80, shooting: null, passing: 80, dribbling: 80, defending: 80, physical: 80 })).toBeNull();
  });
});
