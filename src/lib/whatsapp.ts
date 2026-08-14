export type ImportedPlayer={nome:string;grupo:'linha'|'suplente'|'goleiro'}

export function parseWhatsAppList(text:string):ImportedPlayer[]{let grupo:ImportedPlayer['grupo']='linha';const result:ImportedPlayer[]=[];for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(/^suplentes?/i.test(line)){grupo='suplente';continue}if(/^goleiros?/i.test(line)){grupo='goleiro';continue}const match=line.match(/^\s*\d+\s*[-–—.)]\s*(.+?)\s*$/);if(match?.[1])result.push({nome:match[1].trim(),grupo})}return result}

export function formatWhatsAppList(title:string,line:string[],waiting:string[],keepers:string[]){const numbered=(items:string[],minimum=0)=>Array.from({length:Math.max(items.length,minimum)},(_,i)=>`${i+1}- ${items[i]??''}`).join('\n');return `${title}\n\n${numbered(line,20)}\n\nSuplentes\n${numbered(waiting)}\n\nGoleiros\n${numbered(keepers)}`}
