# Check every request against the orders reviews find, before the push

Date: 2026-11-03 · Source: M2c, PR #59 · Status: done (the audit is in #59)

**Observed.** After the lessons `state-table-before-stateful-code.md` and
`fix-the-cause-not-the-finding.md` were in, three more review rounds of #59 found 1, 3 and 3 P2
problems, almost all of them order cases: a late avatar upload wrote back an old form, a pin
answer after the owner left the tab took back a newer pin, the card of an older save replaced a
newer card, the other tab's Save looked on but did nothing. One of them came from the fix of the
round before: the Skills page got the rule "skip a pin answer when the list loaded meanwhile"
without its companion "keep the switch pending until the refresh", so its switch went back to
the old value for a moment. A fix for that round also showed that four tests waited for a
`disabled` attribute that Base UI never sets, so those waits proved nothing.

**Cause.**
- Each fix searched for the same *mechanism* ("who writes pin answers into the cache"), not the
  same *property* ("does every late result know if it is still the newest?"). The card host has
  that property and was not checked, because it writes no pins.
- A rule was copied without the rule it works with. Two copies of one flow (the Always load
  toggle on the bot page and on the Skills page) differed in one line, and that line was the bug.
- The builder's tests followed the path of the fix. The reviewer forces a bad order with held
  answers, and finds what the fix's tests do not reach.
- A wait in a test that passes at once (an attribute the component never sets) looks like proof.

**Change.**
- Before the push, the builder asks five questions of every request on the screen, not only
  those near a finding: a late answer, the component gone, a newer request of the same kind,
  a load or event in between, a refresh that fails or is slow (`../workflow.md` §2 step 4,
  "Order check").
- A review fix searches for the property, takes a rule's companion rules with it, and turns two
  copies of one flow into one (`../workflow.md` §2 step 5).
- Before the report, a fresh reviewer agent that has the code but not the builder's conclusions
  tries to break the screen with forced orders (`../workflow.md` §2 step 4).
- A wait in a test fails when the behaviour is missing; it waits on what the component sets
  (`../testing.md` §5; Base UI's `data-disabled` in `../frontend-conventions.md` §5).

**Audit result (2026-11-03).** The tables (`../design/components/bot-page.md` §4.2, §7.1,
`skills-page.md` §7) found three defects: a Save let go that failed said nothing, the leave
question named no field after its Save answered, and a pin or sort on its way went back over a
refresh. The fresh reviewer agent then found three more that the builder's table missed: an
older pin or sort answering last put its value back, the switch forgot its value when the tab
came back, and the event of one tab's Save showed a conflict on the other tab. A second fresh
pass over those fixes found two more in the new code: a failed sort left the others in its order
while a pin change waited, and a skill added back while its Remove waited stayed hidden. All
eight have a test that failed first. The fresh reviewer earned its place: five of the eight came
from it, so it runs again after its own fixes.

**Rule now in.** `../workflow.md` §2 steps 4 and 5; `../testing.md` §5;
`../frontend-conventions.md` §5.
