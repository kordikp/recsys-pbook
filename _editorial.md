# Editorial Log

Records of content decisions, quality checks, and open issues.

---

## 2026-04-03: Initial Health Check

**Status:** Complete
**Checked by:** Claude Opus 4.6 (automated)

### Issues Found & Resolved
- [x] 3 broken parent references in ch3 depth files (two-tower-math, als-deep, attention-deep)
- [x] Hardcoded highlights moved from JS to frontmatter (90 files)
- [x] Auto-generated low-quality excerpts disabled

### Issues Found & Open
- [ ] 3 question files have malformed YAML in `options:` field (ch3/05, ch4/04, ch5/06) — works in practice because the parser is lenient, but not valid YAML
- [ ] 123 files use `type: spine` regardless of actual type (sidebar/depth) — intentional simplification, may want to restore proper types later
- [ ] 97 files lack highlights — mostly sidebars and depth sections, acceptable for now
- [ ] 30 files lack recallQ/recallA — mostly games and newer additions
- [ ] No depth-thinker companion for Graph Neural Networks (ch3)

### Quality Assessment
- **Tone:** PASS — zero kid-specific language remnants
- **Facts:** PASS — all statistics consistent across files
- **Links:** PASS — 129 URLs, all well-formed, Recombee links consistent
- **Cross-refs:** PASS (after fix) — all parent references valid

### Content Stats
- 190 files, ~163K words, ~9.2 hours reading time
- 7 chapters, 12 missions
- 90 files with highlights, 157 with recallQ/recallA, 163 with teasers
- ~67 Recombee backlinks (blog, docs, research, case studies, GitHub)

---

## Maintenance Workflow

### Regular Health Check (monthly)
1. Run content validation: `node .github/scripts/validate-content.js`
2. Run this health check procedure (tone, cross-refs, metadata, facts, links)
3. Update this editorial log with findings

### Content Addition Workflow
1. Create new .md file with complete frontmatter (id, type, title, readingTime, teaser, recallQ/A, highlights, status)
2. Add to book.json in correct chapter and position
3. Run validation
4. If new section covers a topic mentioned in existing content, add cross-references
5. Check for Recombee backlink opportunities

### Quality Gates
- No file without: id, type, title, readingTime, status
- Spine files should have: teaser, recallQ/A, highlights
- All Recombee research citations should link to research-publications page
- No bare URLs without markdown link formatting in body text
