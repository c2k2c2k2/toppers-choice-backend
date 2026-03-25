# Topper's Choice Product Understanding

## Summary
Topper's Choice is a production-grade education platform for competitive exam preparation with three frontend surfaces: landing page, student app, and admin panel. The platform must be dynamic, admin-driven, mobile-first for students, and maintainable enough to become a SaaS-style product later.

## Major Modules
- Notes for MPSC and allied exams
- Notes for Bank, Staff, Railway, and allied exams
- Career Guidance
- Practice Papers
- Interview Guidance
- English Speaking
- Monthly updates and current affairs
- Landing page CMS
- Student progress and results
- Admin users, roles, permissions, and operations

## User Types
- Public visitor
- Student
- Admin super admin
- Admin content manager
- Admin academic manager
- Admin finance or payments manager
- Admin support or operations manager

## Dynamic And Admin-Managed Areas
- Brand copy, contact info, support details, legal pages
- Exam tracks, mediums, subjects, topics, tags, ordering
- Notes, guidance content, English speaking lessons, current affairs
- Landing sections, banners, featured items, announcements
- Pricing, plans, preview rules, access windows
- Payment provider selection and non-secret runtime settings
- Admin roles, permissions, publishing, visibility, reordering

## Locked Decisions
- One Next.js frontend repo with route groups for landing, student, and admin
- One NestJS backend repo as modular monolith
- PostgreSQL with Prisma
- Hybrid freemium model: some content free, some paid, with controlled preview for premium content
- Both self-signup and admin-created student flows are required
- V1 must be SaaS-ready in structure, but not full multi-tenant
- Payment architecture must be provider-agnostic and dynamic for future HDFC or other gateways
- Minimal environment variables; business runtime configuration should live in the database

## Risks And Open Points To Track
- Premium preview leakage
- Language and medium modeling across Marathi, English, Hindi-English, Marathi-English
- Payment provider switching without frontend rewrites
- PWA caching for protected content
- Clear distinction between PDF notes and structured lesson-style content
- Monthly update workflows and publishing discipline
