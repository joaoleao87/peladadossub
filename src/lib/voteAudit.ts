import type { SuperAdminVote, VoteCategory } from "./database.types";

export const voteLabels: Record<VoteCategory, string> = { destaque: "Destaque", surpresa: "Surpresa", negativo: "Quem quebrou mais", goleiro_destaque: "Melhor goleiro" };

export function groupVotes(votes: SuperAdminVote[], category: VoteCategory | "todos", search: string) {
  const query = search.trim().toLocaleLowerCase(), groups = votes.filter(vote => (category === "todos" || vote.categoria === category) && (!query || [vote.votante_nome, vote.votante_apelido, vote.avaliado_nome, vote.avaliado_apelido, voteLabels[vote.categoria]].some(value => value?.toLocaleLowerCase().includes(query)))).reduce((result, vote) => {
    const player = result[vote.avaliado_jogador_id] ?? { name: vote.avaliado_apelido || vote.avaliado_nome, votes: [] as typeof votes };
    player.votes.push(vote); result[vote.avaliado_jogador_id] = player; return result;
  }, {} as Record<string, { name: string; votes: typeof votes }>);
  return Object.entries(groups).sort(([, a], [, b]) => b.votes.length - a.votes.length || a.name.localeCompare(b.name, "pt-BR"));
}
