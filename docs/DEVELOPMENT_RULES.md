# Companion Development Rules

Version: 1.0

This document defines how Companion must be developed.

Every developer, AI coding assistant, contributor, or future team member must follow these rules.

These rules override personal preferences.

The documentation inside `/docs` is the single source of truth.

---

# 1. Read Documentation First

Before writing a single line of code,

ALWAYS read every document inside `/docs`.

Especially:

01_PROJECT.md

02_VISION.md

03_PRINCIPLES.md

05_CHARACTER.md

13_DESIGN_SYSTEM.md

17_UI_SCREEN_REFERENCE.md

Never assume behavior.

If documentation and code disagree,

documentation wins.

---

# 2. Explain Before Coding

Before making changes,

always provide:

• What will change

• Why it is needed

• Which files will change

• Any possible risks

Wait for approval before implementation.

---

# 3. Modify Existing Code

Never regenerate the project.

Never recreate the application.

Only modify the required files.

Preserve existing structure.

---

# 4. Return Changed Files

After every implementation,

always include:

## Changed Files

src/components/Character.tsx

src/app/home/page.tsx

...

## New Files

(if any)

## Deleted Files

(if any)

## Commands

npm install ...

npm run dev

Never return unnecessary files.

---

# 5. Never Rewrite Working Features

Do not replace working systems.

Improve them.

Refactor only when necessary.

Avoid breaking existing functionality.

---

# 6. Character Rules

The Companion Character is the heart of the application.

Never remove it.

Never hide it without reason.

Every major screen must include the Companion.

Animations should remain active.

---

# 7. UI Rules

Never redesign screens unless requested.

Follow:

13_DESIGN_SYSTEM.md

17_UI_SCREEN_REFERENCE.md

exactly.

Maintain consistency.

---

# 8. Component Rules

Every feature should be modular.

Create reusable components.

Avoid duplicated logic.

One component should have one responsibility.

---

# 9. Performance

Target:

60 FPS

Lazy Loading

Memoization

Dynamic Imports

Optimized Images

Database Indexing

Fast Initial Load

Never sacrifice performance for unnecessary animations.

---

# 10. Code Style

Use:

TypeScript

Functional Components

Hooks

Reusable Utilities

Meaningful Names

Readable Code

Avoid magic numbers.

Avoid deeply nested logic.

---

# 11. Folder Rules

Do not create random folders.

Follow:

12_ARCHITECTURE.md

If a new folder is required,

justify why.

---

# 12. Animation Rules

Animations should be subtle.

Natural.

Premium.

Never distracting.

Never flashy.

Never repetitive.

Follow:

08_ANIMATIONS.md

---

# 13. AI Rules

AI should never replace the Companion.

AI works quietly.

The Companion communicates.

Never expose technical prompts to users.

---

# 14. Database Rules

Never duplicate data.

Reference documents where possible.

Timestamp all important events.

Write scalable schemas.

Think for millions of users.

---

# 15. Notifications

Notifications must feel helpful.

Not demanding.

Never spam.

Never interrupt Focus Mode unless necessary.

---

# 16. Accessibility

Every feature must support:

Keyboard Navigation

Reduced Motion

Screen Readers

Responsive Layouts

High Contrast

Accessibility is not optional.

---

# 17. Security

Never expose:

Private Keys

Secrets

Environment Variables

Firebase Admin Credentials

OpenAI Keys

Validate every API.

Sanitize every input.

---

# 18. Git Rules

Every major feature should have its own commit.

Example:

git commit -m "Added Character Creator"

git commit -m "Implemented Memory Garden"

Keep commits small and meaningful.

---

# 19. Libraries

Before adding a dependency,

ask:

Can this be built using existing tools?

If a library is necessary,

explain why.

Avoid dependency bloat.

---

# 20. Error Handling

Never allow blank pages.

Never crash silently.

Always provide meaningful error messages.

The Companion should gently explain when something goes wrong.

---

# 21. Logging

Log useful debugging information.

Never log passwords.

Never log secrets.

Never expose user data.

---

# 22. Testing

New features should not break:

Authentication

Character

Tasks

Focus Mode

Journal

Worlds

Navigation

Test before completing implementation.

---

# 23. Responsive Design

Desktop

Tablet

Mobile

All features must work on all screen sizes.

Do not build desktop-only interfaces.

---

# 24. Future Compatibility

Every feature should be designed assuming:

Android App

iOS App

Desktop App

WearOS

Apple Watch

AR

VR

Avoid decisions that block future platforms.

---

# 25. Documentation

Whenever a major feature is added,

update:

07_FEATURES.md

14_ROADMAP.md

10_DATABASE.md (if schema changes)

17_UI_SCREEN_REFERENCE.md (if UI changes)

Documentation should evolve with the product.

---

# 26. Development Workflow

Every feature should follow this order:

1. Read documentation.

2. Explain implementation plan.

3. Wait for approval.

4. Implement.

5. Test.

6. Return changed files.

7. Update documentation.

Never skip steps.

---

# 27. Product Philosophy

Every feature must answer:

Does this strengthen the relationship between the user and their Companion?

If the answer is "No",

the feature should be reconsidered.

---

# 28. Definition of Done

A feature is complete only if:

✔ Works correctly

✔ Responsive

✔ Animated

✔ Accessible

✔ Documented

✔ Tested

✔ Matches Companion's philosophy

✔ Does not break existing features

If any item is missing,

the feature is not finished.

---

# Final Rule

Whenever there is uncertainty,

do not guess.

Read the Companion documentation.

If still uncertain,

ask before implementing.

Companion is built through thoughtful decisions,

not assumptions.