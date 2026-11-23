import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ROUNDS,
  buildParsedTableAndMapping,
  createDemoParticipants,
  deduplicateParticipants,
  drawWinnersFromPool,
  exportWinnersToCsv,
  getNextIncompleteRoundId,
  getRoundProgress,
  mapTableToParticipants,
  parseDelimitedText,
  redrawSingleWinner,
  secureShuffle,
} from './raffleEngine';

test('default draw sequence matches 150 -> 50 -> 35 -> 25 winners', () => {
  assert.deepEqual(
    DEFAULT_ROUNDS.map((r) => r.winnerCount),
    [150, 50, 35, 25]
  );
  assert.deepEqual(
    DEFAULT_ROUNDS.map((r) => r.order),
    [1, 2, 3, 4]
  );
});

test('drawWinnersFromPool removes picked winners from the main pool automatically', () => {
  const pool = createDemoParticipants(300);
  const round1 = DEFAULT_ROUNDS[0]; // 150 winners

  const result = drawWinnersFromPool({
    pool,
    round: round1,
    existingRoundWinners: [],
    requestedCount: 150,
    removeWinnerFromPool: true,
    removeAllEntriesByName: false,
    nowIso: '2026-11-22T10:00:00.000Z',
  });

  assert.equal(result.drawnCount, 150);
  assert.equal(result.newWinners.length, 150);
  assert.equal(result.remainingPool.length, 150);

  const winnerIds = new Set(result.newWinners.map((w) => w.participant.id));
  assert.equal(winnerIds.size, 150);

  for (const remaining of result.remainingPool) {
    assert.equal(winnerIds.has(remaining.id), false, 'Winner must be removed from main pool');
  }
});

test('full sequence 150 -> 50 -> 35 -> 25 draws 260 unique winners leaving 40 in a 300-entry pool', () => {
  let pool = createDemoParticipants(300);
  let allWinners = [] as ReturnType<typeof drawWinnersFromPool>['newWinners'];

  for (const round of DEFAULT_ROUNDS) {
    assert.equal(getNextIncompleteRoundId(DEFAULT_ROUNDS, allWinners), round.id);
    const draw = drawWinnersFromPool({
      pool,
      round,
      existingRoundWinners: allWinners,
      requestedCount: round.winnerCount,
      removeWinnerFromPool: true,
      removeAllEntriesByName: false,
    });
    assert.equal(draw.drawnCount, round.winnerCount);
    pool = draw.remainingPool;
    allWinners = [...allWinners, ...draw.newWinners];
  }

  assert.equal(allWinners.length, 260);
  assert.equal(pool.length, 40);
  assert.equal(new Set(allWinners.map((w) => w.participant.id)).size, 260);

  const progress = getRoundProgress(DEFAULT_ROUNDS, allWinners);
  assert.equal(progress.every((p) => p.isComplete), true);
});

test('removeAllEntriesByName removes all tickets owned by the winning person', () => {
  const pool = [
    { id: '1', name: 'Maria Santos', ticketNumber: 'T-01' },
    { id: '2', name: 'maria   santos ', ticketNumber: 'T-02' },
    { id: '3', name: 'Juan Cruz', ticketNumber: 'T-03' },
  ];

  const draw = drawWinnersFromPool({
    pool,
    round: DEFAULT_ROUNDS[3],
    existingRoundWinners: [],
    requestedCount: 1,
    removeWinnerFromPool: true,
    removeAllEntriesByName: true,
    rng: () => 0, // deterministically picks index 0 (Maria Santos)
  });

  assert.equal(draw.drawnCount, 1);
  assert.equal(draw.newWinners[0].participant.name, 'Maria Santos');
  assert.equal(draw.remainingPool.length, 1);
  assert.equal(draw.remainingPool[0].name, 'Juan Cruz');
});

test('redrawSingleWinner voids absent winner and replaces same slot from remaining pool', () => {
  const pool = createDemoParticipants(10);
  const firstDraw = drawWinnersFromPool({
    pool,
    round: DEFAULT_ROUNDS[3],
    existingRoundWinners: [],
    requestedCount: 2,
    removeWinnerFromPool: true,
    removeAllEntriesByName: false,
    rng: () => 0,
  });

  const targetWinner = firstDraw.newWinners[0];
  const redraw = redrawSingleWinner({
    winnerId: targetWinner.id,
    winners: firstDraw.newWinners,
    pool: firstDraw.remainingPool,
    removeWinnerFromPool: true,
    removeAllEntriesByName: false,
    rng: () => 0,
  });

  assert.ok(redraw.replacementWinner);
  assert.equal(redraw.replacementWinner?.slotNumber, targetWinner.slotNumber);
  assert.equal(redraw.remainingPool.length, 7);
  const voided = redraw.updatedWinners.find((w) => w.id === targetWinner.id);
  assert.equal(voided?.status, 'voided');
  assert.equal(
    redraw.updatedWinners.filter((w) => w.status === 'active').length,
    2
  );
});

test('parseDelimitedText, auto-mapping, deduplication, and CSV export work cleanly', () => {
  const csv = [
    'Ticket No,Full Name,Branch,Email',
    'RF-001,"Santos, Maria",Makati HQ,maria@test.com',
    'RF-002,Juan Cruz,Cebu Hub,juan@test.com',
    'RF-003,"Santos, Maria",Makati HQ,maria@test.com',
  ].join('\n');

  const rows = parseDelimitedText(csv);
  assert.equal(rows.length, 4);

  const { table, mapping } = buildParsedTableAndMapping(rows);
  assert.equal(mapping.hasHeaderRow, true);
  assert.equal(mapping.nameCol, 1);
  assert.equal(mapping.ticketCol, 0);
  assert.equal(mapping.departmentCol, 2);
  assert.equal(mapping.contactCol, 3);

  const participants = mapTableToParticipants(table, mapping, 'RAFFLE ENTRIES 2026');
  assert.equal(participants.length, 3);
  assert.equal(participants[0].name, 'Santos, Maria');

  const deduped = deduplicateParticipants(participants);
  assert.equal(deduped.unique.length, 2);
  assert.equal(deduped.removedCount, 1);

  const draw = drawWinnersFromPool({
    pool: deduped.unique,
    round: DEFAULT_ROUNDS[0],
    existingRoundWinners: [],
    requestedCount: 1,
    removeWinnerFromPool: true,
    removeAllEntriesByName: false,
    rng: () => 0,
  });

  const exported = exportWinnersToCsv(draw.newWinners, DEFAULT_ROUNDS);
  assert.ok(exported.includes('Round Order,Round Title'));
  assert.ok(exported.includes('"Santos, Maria"'));
});

test('secureShuffle preserves all elements without loss', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const shuffled = secureShuffle(input);
  assert.equal(shuffled.length, input.length);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), input);
});

test('parseDelimitedText handles single-column quoted Google Sheets CSV and plain nicknames', () => {
  const quotedSingleCol = '"Full Name"\n"Maria Santos"\n"Santos, Maria"\n"John ""Johnny"" Doe"';
  const rows = parseDelimitedText(quotedSingleCol);
  assert.deepEqual(rows, [
    ['Full Name'],
    ['Maria Santos'],
    ['Santos, Maria'],
    ['John "Johnny" Doe'],
  ]);

  const plainWithNickname = 'Maria Santos\nJohn "Johnny" Doe';
  const plainRows = parseDelimitedText(plainWithNickname);
  assert.deepEqual(plainRows, [['Maria Santos'], ['John "Johnny" Doe']]);
});

test('redrawSingleWinner avoids re-picking voided winner when removeWinnerFromPool is false', () => {
  const pool = createDemoParticipants(2);
  const firstDraw = drawWinnersFromPool({
    pool,
    round: DEFAULT_ROUNDS[3],
    existingRoundWinners: [],
    requestedCount: 1,
    removeWinnerFromPool: false,
    removeAllEntriesByName: false,
    rng: () => 0, // picks index 0
  });

  const targetWinner = firstDraw.newWinners[0];
  const redraw = redrawSingleWinner({
    winnerId: targetWinner.id,
    winners: firstDraw.newWinners,
    pool: firstDraw.remainingPool,
    removeWinnerFromPool: false,
    removeAllEntriesByName: false,
    rng: () => 0,
  });

  assert.ok(redraw.replacementWinner);
  assert.notEqual(redraw.replacementWinner?.participant.id, targetWinner.participant.id);
  assert.equal(redraw.replacementWinner?.participant.id, pool[1].id);
});

test('exportWinnersToCsv uses latest round order, title, and prize from rounds', () => {
  const pool = createDemoParticipants(2);
  const draw = drawWinnersFromPool({
    pool,
    round: DEFAULT_ROUNDS[0],
    existingRoundWinners: [],
    requestedCount: 1,
    removeWinnerFromPool: true,
    removeAllEntriesByName: false,
    rng: () => 0,
  });

  const updatedRounds = DEFAULT_ROUNDS.map((r) =>
    r.id === DEFAULT_ROUNDS[0].id
      ? { ...r, order: 4, title: 'Renamed Finale', prize: 'Updated Cash Prize' }
      : r
  );

  const csv = exportWinnersToCsv(draw.newWinners, updatedRounds);
  assert.ok(csv.includes('4,Renamed Finale,Updated Cash Prize,1,'));
});
