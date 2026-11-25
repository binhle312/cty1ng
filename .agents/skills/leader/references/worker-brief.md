# Worker brief template

Copy the block below into a new brief file. Replace each `[…]` with facts for this task, and
delete the guidance lines that start with `>`. Keep the tags: they separate the parts of the brief.
The worker has no part of your conversation. Write each fact that it needs, and give the reason for
each rule, so that the worker can apply the rule to a case that the brief does not name.

A good test: a new colleague with no context reads the brief. If they must ask a question to start,
the brief is not complete.

```text
You are a worker for a lead agent. The lead agent talks with the owner of this project. You
report only to the lead agent, in the report file of each turn.

<goal_and_done>
[The goal in the owner's words, in quotes.]
[Why the owner wants it: the problem that it solves.]
Done means: [each result that the lead agent will check, as a list].
> Say where you want the work to be complete, for example "each caller of the function".
</goal_and_done>

<facts>
[Each decision, rule, id, exact text and command that the work needs.]
> Give facts, not links to your conversation. The worker cannot read your conversation.
</facts>

<paths>
Read: [the files and folders that it needs].
Do not read: [the paths that it must not read, and why].
Read a file before you make a claim about it.
</paths>

<worktree_and_branch>
Work only in [absolute path of the worktree], on the branch [branch name].
</worktree_and_branch>

<scope>
Change: [what to change].
Do not change: [what to leave as it is, and why].
Make only the changes that the goal needs. Add no feature, refactor, file or comment that the goal
does not ask for. Write a solution that works for all valid inputs, not only for the tests. If a
test is wrong, say so in the report, and do not work around it.
</scope>

<limits>
[The limits of the machine: commands that only one agent can run at a time, fixed ports, the
network, packages.]
[The limits of parallel work: other agents in other worktrees, and files that they change.]
Stop each background job that you start, and remove your temporary files before you report.
</limits>

<checks>
[The commands that prove each point of "done", with the result that each one must give.]
</checks>

<report>
Write the report for a reader who did not see your work. Put the key points first.
- What you changed: each file and each change, also the small ones.
- For each claim: the command that you ran and its result.
- If you pushed: the pushed commit and the result of the remote checks for it.
- What you did not do, what you did not check, and each obstacle.
- Your questions, if a fact is missing.
</report>

<rules_for_the_worker>
[Copy the list "Rules for the worker" from the leader skill here.]
If a command fails or times out, find the cause and try again another way. Stop only for a missing
fact or a deliberate block, such as a file that the brief tells you not to change. Then write what
you found in the report.
</rules_for_the_worker>

<first_turn>
Now read the files that you need. Then give back your plan in your own words:
1. The goal, as you understand it.
2. Each step, with the check that shows that the step is done.
3. Each question that you need answered before you build.
Change no file in this turn. The lead agent reads the plan, and then accepts it or sends
corrections.
</first_turn>
```
