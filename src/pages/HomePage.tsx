import { useState, useEffect } from 'react';
import { TopicsIndex, Category } from '../types/topic';
import { TopicStat } from '../hooks/useTopicProgress';
import { ProgressData } from '../types/progress';
import { getOverallStats } from '../utils/stats';
import { BrandCard } from '../components/Brand';
import { CourseArt } from '../components/SiteHeader';
import { ProgressSummary } from '../components/ProgressSummary';
import { QBankToolbar } from '../components/QBankToolbar';
import { TopicPicker } from '../components/TopicPicker';
import { StartBar } from '../components/StartBar';
import type { ReviewMode } from './ReviewPage';
import { SkinName, SkinAccess, applySkin, savedSkin, loadSkinAccess } from '../utils/skin';
import { ExtrasStatus, ensureExtras, extrasStatus } from '../utils/extras';

interface Props {
  topics: TopicsIndex;
  selectedTopicIds: Set<string>;
  selectedCount: number;
  extrasTopicIds: Set<string>;
  /** Extras available on the current selection but not switched on. */
  availableExtras: number;
  topicStats?: Map<string, TopicStat> | null;
  progress: ProgressData;
  onToggleTopic: (topicId: string) => void;
  onToggleCategory: (category: Category) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onToggleExtras: (topicId: string) => void;
  onToggleCategoryExtras: (category: Category) => void;
  onSetAllExtras: (on: boolean) => void;
  onStartQuiz: () => void;
  onGoToDashboard: () => void;
  onGoToReview: (mode?: ReviewMode) => void;
  onClearProgress: () => void;
  /** High Yield mode: each topic condensed to its high-yield picks. */
  hyMode: boolean;
  onSetHyMode: (on: boolean) => void;
}

export function HomePage({
  topics, selectedTopicIds, selectedCount, extrasTopicIds,
  topicStats, progress,
  onToggleTopic, onToggleCategory, onClearAll, onSetAllExtras,
  onStartQuiz, onGoToDashboard, onGoToReview, onClearProgress,
  hyMode, onSetHyMode,
}: Props) {
  const stats = getOverallStats(progress);
  const allTopics = topics.categories.flatMap(c => c.topics);
  // The endocrine bank (and a handful of never-extended bricks) ship 12
  // questions and nothing more, so the extras switch hides itself there.
  const extraTopics = allTopics.filter(t => (t.extraCount ?? 0) > 0);
  const anyHy = allTopics.some(t => (t.hyCount ?? 0) > 0);
  const hyOf = (t: Category['topics'][number]) =>
    topicStats?.get(t.id)?.hyTotal ?? t.hyCoreCount ?? 0;
  const hyTotal = allTopics.reduce((n, t) => n + hyOf(t), 0);
  const hyLockedExtra = allTopics.reduce((n, t) => n + (t.hyCount ?? 0), 0) - hyTotal;
  const missedCount = Object.values(progress.answers).filter((a) => !a.isCorrect).length;
  const bookmarkCount = progress.bookmarkedQuestions.length;

  // Extras: the global switch drives the same per-topic set the old "+ Extras"
  // buttons did (on = every topic that has extras). Needs a sign-in.
  const [extrasAccess, setExtrasAccess] = useState<ExtrasStatus>(extrasStatus);
  useEffect(() => { ensureExtras().then(setExtrasAccess); }, []);
  const allExtrasOn = extraTopics.length > 0 && extraTopics.every(t => extrasTopicIds.has(t.id));
  const extraQs = extraTopics.reduce((n, t) => n + (t.extraCount ?? 0), 0);

  const [skin, setSkin] = useState<SkinName>(savedSkin);
  const [skinAccess, setSkinAccess] = useState<SkinAccess | null>(null);
  useEffect(() => { loadSkinAccess().then(setSkinAccess); }, []);
  const skinLocked = skinAccess !== null && skinAccess !== 'ok';
  function chooseSkin(next: SkinName) {
    if (skinLocked && next !== 'off') return;
    setSkin(next);
    applySkin(next);
  }

  const sessionsPicked = topics.categories
    .filter(c => c.topics.some(t => selectedTopicIds.has(t.id))).length;

  return (
    <div className="min-h-screen bg-slate-900">
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        <CourseArt />

        {/* Progress shortcuts; empty:hidden drops the row for a new user. */}
        <div className="mb-5 flex items-center gap-2 flex-wrap empty:hidden">
          {stats.total > 0 && (
            <button
              onClick={onGoToDashboard}
              className="px-3.5 py-2 min-h-10 text-sm rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Dashboard ({stats.percentage}%)
            </button>
          )}
          {missedCount > 0 && (
            <button
              onClick={() => onGoToReview('incorrect')}
              className="px-3.5 py-2 min-h-10 text-sm rounded-lg border border-amber-600/70 text-amber-400 hover:bg-amber-500/10 transition-colors"
              title="Redo the questions you got wrong"
            >
              Missed ({missedCount})
            </button>
          )}
          {bookmarkCount > 0 && (
            <button
              onClick={() => onGoToReview()}
              className="px-3.5 py-2 min-h-10 text-sm rounded-lg border border-slate-700 text-amber-400 hover:bg-slate-800 transition-colors"
            >
              Bookmarked ({bookmarkCount})
            </button>
          )}
        </div>

        {stats.total > 0 && (
          <ProgressSummary
            answered={stats.total}
            correct={Math.round(stats.total * stats.percentage / 100)}
            total={topics?.totalQuestions ?? stats.total}
            onReset={onClearProgress}
          />
        )}

        <QBankToolbar
          hy={anyHy ? {
            on: hyMode,
            onChange: onSetHyMode,
            title: `${hyTotal} high-yield questions`
              + (extrasAccess !== 'ok' && hyLockedExtra > 0 ? `; sign in to add ${hyLockedExtra} more` : ''),
          } : null}
          skin={{
            value: skin,
            locked: skinLocked,
            onChange: v => chooseSkin(v as SkinName),
          }}
          extras={extraTopics.length > 0 ? {
            on: allExtrasOn,
            onChange: onSetAllExtras,
            locked: extrasAccess === 'locked',
            disabledReason: hyMode ? 'High Yield already picks from the extras' : undefined,
            title: `Adds ${extraQs} more questions across the bank`,
          } : null}
        />

        <TopicPicker
          categories={topics.categories}
          selectedTopicIds={selectedTopicIds}
          extrasTopicIds={extrasTopicIds}
          topicStats={topicStats}
          hyMode={hyMode}
          sessions={progress.sessions}
          onToggleTopic={onToggleTopic}
          onToggleCategory={onToggleCategory}
        />

        <BrandCard kind="qbank" />

        <StartBar
          sessions={sessionsPicked}
          questions={selectedCount}
          hy={hyMode}
          onStart={onStartQuiz}
          onClear={onClearAll}
        />
      </main>
    </div>
  );
}
