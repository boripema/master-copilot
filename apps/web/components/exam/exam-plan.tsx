"use client";

import { useState } from "react";

import { LinkChips } from "@/components/ui/link-chips";
import { setPlanTick } from "@/lib/api";
import { minutesLeft, planDays, stepDone, stepProgress } from "@/lib/exam-plan";
import type { ExamPrep, PrepPlanStep } from "@/lib/types";


function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} u` : `${hours} u ${rest} min`;
}

/** Wat je nog doet tot het tentamen, per dag en in volgorde, met bij elke stap
 * een knop naar de stof. Bovenaan de pagina, want dit is waarvoor je hier komt;
 * de rest van de pagina is waar de stappen naartoe wijzen. */
export function ExamPlan({ prep }: { prep: ExamPrep }) {
  // Je vinkjes staan in de database: de browser wist zijn eigen opslag soms
  // (Safari na 7 dagen zonder bezoek). Een oefententamen vinkt zichzelf af.
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(prep.ticked));
  const [error, setError] = useState<string | null>(null);

  function flip(current: Set<string>, id: string): Set<string> {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  function toggle(step: PrepPlanStep) {
    const done = !ticked.has(step.id);
    setTicked((current) => flip(current, step.id));
    setError(null);
    setPlanTick(prep.course_slug, step.id, done).catch(() => {
      setTicked((current) => flip(current, step.id));
      setError("Vinkje niet opgeslagen. Draait de API?");
    });
  }

  const left = minutesLeft(prep.plan, prep.exam_sets, ticked);
  const done = prep.plan.filter((step) => stepDone(step, prep.exam_sets, ticked)).length;
  // De balk telt tijd, niet stappen: een stap van anderhalf uur weegt zwaarder dan een kwartier.
  const total = minutesLeft(prep.plan, prep.exam_sets, new Set());
  const share = total > 0 ? (total - left) / total : done / Math.max(prep.plan.length, 1);
  let number = 0;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-base font-semibold text-ink-900">Tot het tentamen</h2>
        <p className="text-sm tabular-nums text-ink-500">
          {done} van {prep.plan.length} gedaan
          {left > 0 && <span> · nog {duration(left)}</span>}
        </p>
      </div>
      <div
        className="mt-2 h-2 w-full rounded-full bg-ink-100"
        role="progressbar"
        aria-label="Voortgang tot het tentamen"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}
      >
        <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${share * 100}%` }} />
      </div>
      <p className="mt-0.5 max-w-3xl text-sm text-ink-500">
        In deze volgorde. Vink af wat je gedaan hebt; een oefententamen vinkt zichzelf af zodra elke vraag een poging
        heeft.
      </p>
      {error && (
        <p role="alert" className="mt-1 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-3 space-y-5">
        {planDays(prep.plan).map(({ day, steps }) => (
          // Een dag kan twee keer voorkomen als er iets anders tussen staat; de eerste stap is uniek.
          <div key={steps[0].id}>
            {day && (
              <h3 className="flex items-baseline gap-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                {day}
                <span className="font-normal normal-case tracking-normal text-ink-400">
                  {duration(steps.reduce((sum, step) => sum + (step.minutes ?? 0), 0))}
                </span>
              </h3>
            )}
            <ol className="mt-2 divide-y divide-ink-100 overflow-hidden rounded-lg border border-ink-100 bg-card">
              {steps.map((step) => {
                number += 1;
                const isDone = stepDone(step, prep.exam_sets, ticked);
                const progress = stepProgress(step, prep.exam_sets);
                return (
                  <li key={step.id} className="flex gap-3 px-4 py-3">
                    <div className="pt-0.5">
                      {step.exam ? (
                        <span
                          aria-label={isDone ? "af" : "nog niet af"}
                          className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                            isDone ? "border-primary-600 bg-primary-600 text-on-fill" : "border-ink-200 text-ink-400"
                          }`}
                        >
                          {isDone ? "✓" : number}
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => toggle(step)}
                          aria-label={`${step.title} afvinken`}
                          className="h-5 w-5 cursor-pointer accent-primary-600"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className={`text-sm font-medium ${isDone ? "text-ink-400 line-through" : "text-ink-900"}`}>
                          {step.title}
                        </p>
                        {step.minutes !== null && (
                          <span className="text-xs tabular-nums text-ink-400">{duration(step.minutes)}</span>
                        )}
                      </div>
                      {step.detail && !isDone && <p className="mt-1 text-sm text-ink-600">{step.detail}</p>}
                      {progress && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 w-40 rounded-full bg-ink-100" aria-hidden>
                            <div
                              className="h-full rounded-full bg-primary-600"
                              style={{ width: `${progress.total ? (progress.answered / progress.total) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-ink-500">
                            {progress.answered} van {progress.total} vragen gemaakt
                          </span>
                        </div>
                      )}
                      {!isDone && <LinkChips links={step.links} className="mt-2" />}
                      {!isDone && step.slides.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Slides</span>
                          <LinkChips links={step.slides} className="" />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
