export interface BracketParticipant {
  id: number;
  discordId: string;
  name: string;
}

export interface BracketMatch {
  matchId: number;
  round: number;
  p1: BracketParticipant | null;
  p2: BracketParticipant | null;
  winner: BracketParticipant | null;
  status: "pending" | "active" | "completed" | "bye";
}

export interface Bracket {
  type: "single_elimination" | "double_elimination" | "round_robin";
  rounds: number;
  matches: BracketMatch[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function generateSingleElimination(participants: BracketParticipant[]): Bracket {
  const shuffled = shuffle(participants);
  const totalSlots = Math.pow(2, Math.ceil(Math.log2(Math.max(shuffled.length, 2))));
  const rounds = Math.log2(totalSlots);
  const matches: BracketMatch[] = [];
  let matchId = 1;

  // First round - pair up participants, byes for empty slots
  for (let i = 0; i < totalSlots / 2; i++) {
    const p1 = shuffled[i * 2] || null;
    const p2 = shuffled[i * 2 + 1] || null;
    const isBye = p1 !== null && p2 === null;
    matches.push({
      matchId: matchId++,
      round: 1,
      p1,
      p2,
      winner: isBye ? p1 : null,
      status: isBye ? "bye" : p1 ? "pending" : "bye",
    });
  }

  // Subsequent rounds
  for (let r = 2; r <= rounds; r++) {
    const matchesInRound = totalSlots / Math.pow(2, r);
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        matchId: matchId++,
        round: r,
        p1: null,
        p2: null,
        winner: null,
        status: "pending",
      });
    }
  }

  return { type: "single_elimination", rounds, matches };
}

export function generateRoundRobin(participants: BracketParticipant[]): Bracket {
  const matches: BracketMatch[] = [];
  let matchId = 1;
  let round = 1;

  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      matches.push({
        matchId: matchId++,
        round,
        p1: participants[i]!,
        p2: participants[j]!,
        winner: null,
        status: "pending",
      });
      round++;
    }
  }

  return { type: "round_robin", rounds: round - 1, matches };
}

export function bracketToText(bracket: Bracket): string {
  const lines: string[] = [`**${bracket.type.replace(/_/g, " ").toUpperCase()} BRACKET**\n`];
  
  const byRound = new Map<number, BracketMatch[]>();
  for (const match of bracket.matches) {
    if (!byRound.has(match.round)) byRound.set(match.round, []);
    byRound.get(match.round)!.push(match);
  }

  for (const [round, roundMatches] of byRound) {
    lines.push(`**── Round ${round} ──**`);
    for (const m of roundMatches) {
      const p1 = m.p1 ? `<@${m.p1.discordId}>` : "*TBD*";
      const p2 = m.p2 ? `<@${m.p2.discordId}>` : "*TBD*";
      const status = m.status === "completed" ? (m.winner ? `✅ Winner: <@${m.winner.discordId}>` : "") : m.status === "bye" ? "*(bye)*" : "⏳";
      lines.push(`Match ${m.matchId}: ${p1} vs ${p2} ${status}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
