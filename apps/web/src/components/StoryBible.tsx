import { ArcBoard } from './ArcBoard';
import { PromiseBoard } from './PromiseBoard';
import { SecretBoard } from './SecretBoard';
import { TimelineMap } from './TimelineMap';
import { WorldRuleMap } from './WorldRuleMap';

export function StoryBible() {
  return (
    <section className="story-bible" id="story-bible" aria-label="Story Bible">
      <PromiseBoard />
      <SecretBoard />
      <ArcBoard />
      <TimelineMap />
      <WorldRuleMap />
    </section>
  );
}
