import { expect, test } from "vitest";
import { groupVotes } from "./voteAudit";
import type { SuperAdminVote } from "./database.types";

const vote = (player: string, voter: string, category: SuperAdminVote["categoria"] = "destaque"): SuperAdminVote => ({ votante_user_id: voter, votante_nome: voter, votante_apelido: null, categoria: category, avaliado_jogador_id: player, avaliado_nome: player, avaliado_apelido: null, criado_em: "", atualizado_em: "" });

test("agrupa votos por jogador e respeita filtros", () => {
  const groups = groupVotes([vote("Beto", "Caio"), vote("Ana", "Duda"), vote("Beto", "Eva", "surpresa")], "todos", "");
  expect(groups.map(([, group]) => [group.name, group.votes.length])).toEqual([["Beto", 2], ["Ana", 1]]);
  expect(groupVotes(groups.flatMap(([, group]) => group.votes), "surpresa", "beto")).toHaveLength(1);
});
