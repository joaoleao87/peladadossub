import { describe, expect, it } from "vitest";
import type { PlayerCardData } from "./database.types";
import { playerCardStatus } from "./playerCard";

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
