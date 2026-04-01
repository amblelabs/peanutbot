interface Ballot {
  ranking: number[];
  weight: number;
}

interface Round {
  counts: Record<number, number>;
  elected: number[];
  eliminated: number[];
  quota: number;
}

export function stv(
  candidates: number[],
  votes: Ballot[],
  seats: number,
): { elected: number[]; rounds: Round[] } {
  // Deep copy ballots
  let ballots = votes.map((v) => ({
    ranking: [...v.ranking],
    weight: v.weight,
  }));

  const totalVotes = ballots.reduce((sum, b) => sum + b.weight, 0);
  const quota = Math.floor(totalVotes / (seats + 1)) + 1;

  let elected: number[] = [];
  let eliminated: number[] = [];
  let remaining = [...candidates];
  const rounds: Round[] = [];

  while (elected.length < seats && remaining.length > 0) {
    const counts: Record<number, number> = {};
    for (const cand of remaining) counts[cand] = 0;

    // Count first preferences
    for (const ballot of ballots) {
      for (const candId of ballot.ranking) {
        if (remaining.includes(candId)) {
          counts[candId] += ballot.weight;
          break;
        }
      }
    }

    let electedThisRound: number[] = [];
    for (const cand of remaining) {
      if (counts[cand] >= quota) electedThisRound.push(cand);
    }

    if (electedThisRound.length > 0) {
      // Elect all that meet quota (in order of highest count)
      electedThisRound.sort((a, b) => counts[b] - counts[a]);
      for (const cand of electedThisRound) {
        if (elected.length >= seats) break;

        elected.push(cand);
        remaining = remaining.filter((c) => c !== cand);

        const surplus = counts[cand] - quota;
        const transferValue = surplus / counts[cand];

        for (const ballot of ballots) {
          // Find first remaining candidate or the elected one
          let firstRemaining: number | null = null;
          for (const c of ballot.ranking) {
            if (remaining.includes(c) || c === cand) {
              firstRemaining = c;
              break;
            }
          }
          if (firstRemaining === cand) {
            ballot.weight *= transferValue;
            ballot.ranking = ballot.ranking.filter((c) => c !== cand);
          }
        }
      }
    } else {
      // No one met quota – eliminate the candidate with fewest votes
      let minCount = Infinity;
      let toEliminate: number[] = [];
      for (const cand of remaining) {
        if (counts[cand] < minCount) {
          minCount = counts[cand];
          toEliminate = [cand];
        } else if (counts[cand] === minCount) {
          toEliminate.push(cand);
        }
      }
      toEliminate.sort();
      const eliminatedCand = toEliminate[0];
      eliminated.push(eliminatedCand);
      remaining = remaining.filter((c) => c !== eliminatedCand);
      // Remove eliminated candidate from ballots
      for (const ballot of ballots) {
        ballot.ranking = ballot.ranking.filter((c) => c !== eliminatedCand);
      }
    }

    rounds.push({
      counts: { ...counts },
      elected: [...elected],
      eliminated: [...eliminated],
      quota,
    });
  }

  return { elected, rounds };
}
