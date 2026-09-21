(function () {
  "use strict";


  // ---- graph: actor -> list of title indices, and BFS over shared titles -
  const actorTitles = Object.create(null);
  TITLES.forEach((t, i) => {
    t.cast.forEach((a) => {
      (actorTitles[a] || (actorTitles[a] = [])).push(i);
    });
  });
  const ALL_ACTORS = Object.keys(actorTitles);

  function coStarsOf(actor) {
    const set = new Set();
    actorTitles[actor].forEach((ti) => TITLES[ti].cast.forEach((a) => { if (a !== actor) set.add(a); }));
    return set;
  }

  function bfsDistance(start, target) {
    if (start === target) return 0;
    let frontier = new Set([start]);
    const visited = new Set([start]);
    let dist = 0;
    while (frontier.size) {
      dist++;
      const next = new Set();
      for (const a of frontier) {
        for (const n of coStarsOf(a)) {
          if (visited.has(n)) continue;
          if (n === target) return dist;
          visited.add(n);
          next.add(n);
        }
      }
      frontier = next;
    }
    return Infinity;
  }

  // Reconstructs one shortest actor-to-actor path (for the "Give Up" reveal),
  // then turns each consecutive pair into a shared-title chain step so it
  // renders with the exact same chip markup as a played-out chain.
  function bfsPath(start, target) {
    if (start === target) return [start];
    const parent = new Map();
    const visited = new Set([start]);
    let frontier = [start];
    while (frontier.length) {
      const next = [];
      for (const a of frontier) {
        for (const n of coStarsOf(a)) {
          if (visited.has(n)) continue;
          visited.add(n);
          parent.set(n, a);
          if (n === target) {
            const path = [target];
            let cur = target;
            while (cur !== start) {
              cur = parent.get(cur);
              path.push(cur);
            }
            return path.reverse();
          }
          next.push(n);
        }
      }
      frontier = next;
    }
    return null;
  }

  function sharedTitleIdx(a, b) {
    return actorTitles[a].find((ti) => TITLES[ti].cast.includes(b));
  }

  function solutionChain(start, target) {
    const path = bfsPath(start, target);
    const result = [path[0]];
    for (let i = 1; i < path.length; i++) {
      result.push(sharedTitleIdx(path[i - 1], path[i]));
      result.push(path[i]);
    }
    return result;
  }

  // Only actors with a handful of titles to their name make good puzzle
  // endpoints — anyone with just one or two leaves the very first pick
  // (or the final one) with barely any real choice.
  const WELL_CONNECTED = ALL_ACTORS.filter((a) => actorTitles[a].length >= 3);

  function pickPuzzle() {
    const pool = WELL_CONNECTED.length ? WELL_CONNECTED : ALL_ACTORS;
    for (let attempt = 0; attempt < 800; attempt++) {
      const a = pool[(Math.random() * pool.length) | 0];
      const b = pool[(Math.random() * pool.length) | 0];
      if (a === b) continue;
      const d = bfsDistance(a, b);
      if (d >= 2 && d <= 4) return { start: a, target: b, optimal: d };
    }
    // Fallback: exhaustively scan for any valid pair (dataset is small enough).
    for (const a of pool) {
      for (const b of pool) {
        if (a === b) continue;
        const d = bfsDistance(a, b);
        if (d >= 2 && d <= 4) return { start: a, target: b, optimal: d };
      }
    }
    return { start: pool[0], target: pool[1], optimal: bfsDistance(pool[0], pool[1]) };
  }

  // ---- scoring ---------------------------------------------------------
  // Perfect (optimal) chains score highest, and harder puzzles (bigger
  // optimal) raise the ceiling; every step beyond optimal costs a chunk of
  // that, down to a small floor for finishing at all. Give Up always scores 0.
  function computeScore(optimal, used) {
    const overPar = Math.max(0, used - optimal);
    return Math.max(10, optimal * 100 - overPar * 40);
  }

  function loadBestScore() {
    try {
      return Number(localStorage.getItem("castChainBestScore")) || 0;
    } catch (e) {
      return 0;
    }
  }
  function saveBestScore(v) {
    try {
      localStorage.setItem("castChainBestScore", String(v));
    } catch (e) {
      /* private window / blocked storage — best score just won't persist */
    }
  }

  // ---- game state ----------------------------------------------------------
  // chain alternates: [actorName, titleIndex, actorName, titleIndex, ..., actorName]
  // No undo: a pick is permanent — Restart Chain rewinds all the way, Give Up
  // reveals a solution, but there's no stepping back one move at a time.
  let puzzle = null;
  let chain = [];
  let solved = false;
  let gaveUp = false;
  let sessionScore = 0;
  let bestRoundScore = loadBestScore();

  const el = {
    board: document.getElementById("board"),
    start: document.getElementById("plate-start"),
    target: document.getElementById("plate-target"),
    steps: document.getElementById("stat-steps"),
    difficulty: document.getElementById("stat-difficulty"),
    scoreTotal: document.getElementById("stat-score"),
    chain: document.getElementById("chain"),
    picker: document.getElementById("picker"),
    prompt: document.getElementById("picker-prompt"),
    filter: document.getElementById("picker-filter"),
    list: document.getElementById("picker-list"),
    win: document.getElementById("win-panel"),
    winHeadline: document.getElementById("win-headline"),
    winDetail: document.getElementById("win-detail"),
    winScore: document.getElementById("win-score"),
    winBest: document.getElementById("win-best"),
    winRevealLink: document.getElementById("win-reveal-link"),
    winOptimalChain: document.getElementById("win-optimal-chain"),
  };

  // Both plates share this shape — keyed by "start"/"target" so the same
  // open/close/commit logic works for either side.
  const plates = {
    start: {
      box: document.getElementById("plate-start-box"),
      name: document.getElementById("plate-start"),
      hint: document.querySelector("#plate-start-box .plate__hint"),
      edit: document.getElementById("plate-start-edit"),
      input: document.getElementById("plate-start-input"),
      list: document.getElementById("plate-start-edit-list"),
      message: document.getElementById("plate-start-edit-message"),
    },
    target: {
      box: document.getElementById("plate-target-box"),
      name: document.getElementById("plate-target"),
      hint: document.querySelector("#plate-target-box .plate__hint"),
      edit: document.getElementById("plate-target-edit"),
      input: document.getElementById("plate-target-input"),
      list: document.getElementById("plate-target-edit-list"),
      message: document.getElementById("plate-target-edit-message"),
    },
  };

  function usedActors() {
    return new Set(chain.filter((_, i) => i % 2 === 0));
  }
  function usedTitleIdx() {
    return new Set(chain.filter((_, i) => i % 2 === 1));
  }
  function currentActor() {
    return chain[chain.length - 1];
  }

  // Random mode caps difficulty at 4 steps, but a deliberately-chosen pair
  // (via "Choose your own actors") can be any distance apart — cap the dots
  // display at 4 filled and spell out the exact count above that.
  function renderDifficulty(optimal) {
    const filled = Math.min(Math.max(optimal - 1, 0), 4);
    const extra = optimal > 4 ? " · " + optimal + " steps" : "";
    return "DIFFICULTY: <b>" + "●".repeat(filled) + "○".repeat(4 - filled) + "</b>" + extra;
  }

  function beginPuzzle(p) {
    puzzle = p;
    chain = [puzzle.start];
    solved = false;
    gaveUp = false;
    el.start.textContent = puzzle.start;
    el.target.textContent = puzzle.target;
    el.difficulty.innerHTML = renderDifficulty(puzzle.optimal);
    el.win.hidden = true;
    el.win.classList.remove("win--reveal");
    resetWinExtras();
    el.picker.hidden = false;
    render();
  }

  function startNewPuzzle() {
    beginPuzzle(pickPuzzle());
  }

  function restartChain() {
    chain = [puzzle.start];
    solved = false;
    gaveUp = false;
    el.win.hidden = true;
    el.win.classList.remove("win--reveal");
    resetWinExtras();
    el.picker.hidden = false;
    render();
  }

  function resetWinExtras() {
    el.winRevealLink.hidden = true;
    el.winOptimalChain.hidden = true;
    el.winOptimalChain.innerHTML = "";
    el.winBest.hidden = true;
  }

  function giveUp() {
    chain = solutionChain(puzzle.start, puzzle.target);
    gaveUp = true;
    el.winHeadline.textContent = "Here's one way";
    el.winDetail.innerHTML =
      "The shortest possible link was <b>" + puzzle.optimal + "</b> step" + (puzzle.optimal === 1 ? "" : "s") + ".";
    resetWinExtras();
    el.winScore.textContent = "+0 points";
    el.winScore.classList.add("win__score--zero");
    el.win.classList.add("win--reveal");
    el.win.hidden = false;
    render();
  }

  function render() {
    el.steps.textContent = usedTitleIdx().size;

    // chain chips
    el.chain.innerHTML = chain
      .map((item, i) => {
        if (i % 2 === 0) {
          const isTarget = (solved || gaveUp) && i === chain.length - 1;
          return (
            '<span class="chip chip--actor' + (isTarget ? " chip--target-hit" : "") + '" role="listitem">' +
            escapeHtml(item) +
            "</span>"
          );
        }
        return '<span class="chip chip--title" role="listitem">' + escapeHtml(TITLES[item].name) + "</span>";
      })
      .join('<span class="chip chip--link" aria-hidden="true">→</span>');

    if (solved || gaveUp) {
      el.picker.hidden = true;
      return;
    }

    // picker
    const actor = currentActor();
    const needsTitle = chain.length % 2 === 1;
    const usedT = usedTitleIdx();
    const usedA = usedActors();
    const term = el.filter.value.trim().toLowerCase();

    let options;
    if (needsTitle) {
      el.prompt.innerHTML = "What did <em>" + escapeHtml(actor) + "</em> star in?";
      options = actorTitles[actor]
        .filter((ti) => !usedT.has(ti))
        .map((ti) => ({ kind: "title", idx: ti, label: TITLES[ti].name, sub: TITLES[ti].year }));
    } else {
      const titleIdx = chain[chain.length - 1];
      el.prompt.innerHTML = "Who else was in <em>" + escapeHtml(TITLES[titleIdx].name) + "</em>?";
      options = TITLES[titleIdx].cast
        .filter((a) => a !== actor && !usedA.has(a))
        .map((a) => ({ kind: "actor", name: a, label: a, sub: null }));
    }

    if (term) {
      options = options.filter((o) => o.label.toLowerCase().includes(term));
    }

    if (!options.length) {
      el.list.innerHTML = '<p class="empty-note">No matches. Try clearing the search.</p>';
      return;
    }

    el.list.innerHTML = options
      .map((o, i) => {
        const sub = o.sub ? "<small>" + o.sub + "</small>" : "";
        return (
          '<button type="button" class="option" data-i="' + i + '">' + escapeHtml(o.label) + sub + "</button>"
        );
      })
      .join("");

    Array.from(el.list.children).forEach((node, i) => {
      node.addEventListener("click", () => choose(options[i]));
    });
  }

  function choose(option) {
    if (option.kind === "title") {
      chain.push(option.idx);
    } else {
      chain.push(option.name);
      if (option.name === puzzle.target) {
        solved = true;
        const used = usedTitleIdx().size;
        const hitOptimal = used <= puzzle.optimal;
        const earned = computeScore(puzzle.optimal, used);
        sessionScore += earned;
        el.scoreTotal.textContent = sessionScore;
        el.winHeadline.textContent = hitOptimal ? "Optimal chain!" : "Solved!";
        el.winDetail.innerHTML =
          "You linked them in <b>" + used + "</b> step" + (used === 1 ? "" : "s") +
          " — the shortest possible was <b>" + puzzle.optimal + "</b>.";
        resetWinExtras();
        el.winScore.textContent = "+" + earned + " points";
        el.winScore.classList.remove("win__score--zero");
        if (earned > bestRoundScore) {
          bestRoundScore = earned;
          saveBestScore(bestRoundScore);
          el.winBest.hidden = false;
        }
        el.winRevealLink.hidden = hitOptimal;
        el.win.hidden = false;
      }
    }
    el.filter.value = "";
    render();
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  el.filter.addEventListener("input", render);
  document.getElementById("btn-restart").addEventListener("click", restartChain);
  document.getElementById("btn-giveup").addEventListener("click", giveUp);
  document.getElementById("btn-new").addEventListener("click", startNewPuzzle);
  document.getElementById("win-next").addEventListener("click", startNewPuzzle);
  el.winRevealLink.addEventListener("click", () => {
    const optimal = solutionChain(puzzle.start, puzzle.target);
    el.winOptimalChain.innerHTML = optimal
      .map((item, i) =>
        i % 2 === 0
          ? '<span class="chip chip--actor">' + escapeHtml(item) + "</span>"
          : '<span class="chip chip--title">' + escapeHtml(TITLES[item].name) + "</span>"
      )
      .join('<span class="chip chip--link" aria-hidden="true">→</span>');
    el.winOptimalChain.hidden = false;
    el.winRevealLink.hidden = true;
  });

  // ---- inline plate editing (tap Start or Reach to pick your own actor) ----
  // Each plate edits independently and commits immediately on a valid pick —
  // no separate "confirm" step. Picking one side keeps whatever the other
  // side currently shows (random or previously chosen).
  let openSide = null;

  function otherSide(side) {
    return side === "start" ? "target" : "start";
  }

  function openPlateEditor(side) {
    if (openSide === side) return;
    if (openSide) closePlateEditor(openSide);
    openSide = side;
    const p = plates[side];
    p.name.hidden = true;
    p.hint.hidden = true;
    p.edit.hidden = false;
    p.input.value = "";
    p.list.innerHTML = "";
    p.message.textContent = "";
    p.input.focus();
  }

  function closePlateEditor(side) {
    const p = plates[side];
    p.edit.hidden = true;
    p.name.hidden = false;
    p.hint.hidden = false;
    p.input.value = "";
    p.list.innerHTML = "";
    p.message.textContent = "";
    if (openSide === side) openSide = null;
  }

  function renderPlateSearch(side) {
    const p = plates[side];
    const term = p.input.value.trim().toLowerCase();
    const exclude = puzzle[otherSide(side)];
    if (!term) {
      p.list.innerHTML = "";
      return;
    }
    const matches = ALL_ACTORS
      .filter((a) => a !== exclude && a.toLowerCase().includes(term))
      .slice(0, 30);
    if (!matches.length) {
      p.list.innerHTML = '<p class="empty-note">No matches.</p>';
      return;
    }
    p.list.innerHTML = matches
      .map((name, i) => '<button type="button" class="option" data-i="' + i + '">' + escapeHtml(name) + "</button>")
      .join("");
    Array.from(p.list.children).forEach((node, i) => {
      node.addEventListener("click", () => commitPlatePick(side, matches[i]));
    });
  }

  function commitPlatePick(side, name) {
    const p = plates[side];
    const other = puzzle[otherSide(side)];
    if (name === other) {
      p.message.textContent = "Pick someone different from the other name.";
      return;
    }
    const d = bfsDistance(name, other);
    if (d === 1) {
      p.message.textContent = "They already starred together — try someone else.";
      return;
    }
    if (!Number.isFinite(d)) {
      p.message.textContent = "No connection exists between these two — try someone else.";
      return;
    }
    const newPuzzle = side === "start"
      ? { start: name, target: other, optimal: d }
      : { start: other, target: name, optimal: d };
    closePlateEditor(side);
    beginPuzzle(newPuzzle);
  }

  Object.keys(plates).forEach((side) => {
    const p = plates[side];
    p.box.addEventListener("click", () => openPlateEditor(side));
    p.box.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPlateEditor(side);
      }
    });
    p.input.addEventListener("click", (e) => e.stopPropagation());
    p.input.addEventListener("input", () => renderPlateSearch(side));
  });

  document.addEventListener("click", (e) => {
    if (!openSide) return;
    if (!plates[openSide].box.contains(e.target)) closePlateEditor(openSide);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openSide) closePlateEditor(openSide);
  });

  startNewPuzzle();
})();
