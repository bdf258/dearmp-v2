# Case Page Design Considerations

## Overview

The case page is the central hub for caseworkers to manage constituent enquiries. It needs to display a substantial amount of information while remaining accessible to users who may not be digitally native. This document outlines the design considerations and features for three prototype approaches.

## Information Requirements

The case page must display:

1. **Case Metadata**
   - Case title and reference number
   - Status (open, pending, closed, archived)
   - Priority level
   - Creation and last updated dates
   - Assignee (staff member)

2. **People & Organisations**
   - Primary constituent (the person who raised the case)
   - Related parties (family members, witnesses, etc.)
   - Organisations involved (councils, NHS trusts, etc.)
   - Contact details and relationship to case

3. **Communications**
   - Email threads (inbound and outbound)
   - Individual emails with full content
   - Attachments (referenced)
   - Timeline of communications

4. **Research & Context**
   - AI-generated research report
   - Background information on the issue
   - Relevant policies or legislation
   - Similar past cases (if applicable)

5. **Organisation & Classification**
   - Tags for categorisation
   - Case notes (internal)
   - Activity log

6. **Statistics**
   - Response times
   - Number of communications
   - Time since last contact
   - Case age

---

## Design Challenges

### Challenge 1: Information Overload
Caseworkers need access to comprehensive information, but presenting everything at once can overwhelm users, especially those less comfortable with technology.

**Solutions Explored:**
- Progressive disclosure (show summary, reveal details on demand)
- Simple/Detailed mode toggle
- Collapsible sections
- Tab-based navigation

### Challenge 2: Varying User Expertise
Users range from digitally-native young staff to experienced caseworkers who may be less comfortable with complex interfaces.

**Solutions Explored:**
- Clear, descriptive labels (avoid jargon)
- Familiar metaphors (folders, files, tabs)
- Consistent, predictable layouts
- Large click targets
- Clear visual hierarchy

### Challenge 3: Finding Information Quickly
When a constituent calls, caseworkers need to find relevant information immediately.

**Solutions Explored:**
- Key information always visible (constituent name, contact details)
- Search within case
- Clear section headers
- Sticky headers/navigation

### Challenge 4: Context Switching
Caseworkers often handle multiple cases and need to quickly understand where they left off.

**Solutions Explored:**
- Activity timeline
- "Last action" indicator
- Prominent status display
- Recent communications highlighted

---

## Prototype Approaches

### Prototype 1: Tab-Based Navigation
**Path: `/prototypes/case/tabs`**

A familiar tabbed interface that separates information into discrete sections.

**Pros:**
- Familiar pattern (like browser tabs)
- Reduces visual clutter
- Each tab has a focused purpose
- Easy to understand for all skill levels

**Cons:**
- Requires clicking to see different information
- Can't see everything at once
- May require tab-switching during phone calls

**Features:**
- Overview tab with key stats and summary
- Communications tab for email threads
- People & Organisations tab
- Research tab for AI insights
- Activity tab for case history

### Prototype 2: Two-Column Layout
**Path: `/prototypes/case/columns`**

A sidebar + main content approach with a Simple/Detailed toggle.

**Pros:**
- Key information always visible in sidebar
- Main content area for focused work (emails, notes)
- Toggle allows users to control complexity
- Efficient use of screen space

**Cons:**
- More information visible at once (could overwhelm)
- Requires wider screens for best experience
- Simple mode might hide needed information

**Features:**
- Left sidebar: constituent info, tags, assignee, quick stats
- Main area: email thread and research
- Floating "Simple/Detailed" toggle
- Simple mode hides secondary information

### Prototype 3: Collapsible Cards (Accordion)
**Path: `/prototypes/case/cards`**

All information on one page in expandable/collapsible cards.

**Pros:**
- User controls what's visible
- Can expand multiple sections
- Single scrollable page
- Familiar expand/collapse pattern

**Cons:**
- More clicking to reveal information
- Scrolling may be required to find sections
- State of expanded sections needs to be remembered

**Features:**
- Stacked cards for each information category
- Click to expand/collapse
- "Expand All / Collapse All" controls
- Persistent header with case title and quick actions

---

## Feature Considerations

### Simple vs Detailed Mode
For Prototype 2, we implement a toggle between modes:

**Simple Mode Shows:**
- Constituent name and primary contact method
- Case status and priority
- Most recent email (collapsed)
- Primary action buttons

**Detailed Mode Adds:**
- Full constituent profile
- All related parties and organisations
- Complete email thread
- Research report
- Activity log
- Case statistics

### Tooltips as Design Documentation
All prototypes include tooltips that explain the purpose of each element. This serves dual purposes:
1. Helps evaluate the design by explaining intent
2. Could be adapted into user-facing help text

### Responsive Considerations
While caseworkers primarily use desktop computers, the design should degrade gracefully on smaller screens. Prototype 2's two-column layout will need special attention for tablet users.

### Accessibility
- All interactive elements are keyboard accessible
- Colour is not the only indicator of status
- Text meets contrast requirements
- Clear focus indicators

---

## Recommended Next Steps

1. **User Testing**: Show prototypes to actual caseworkers
2. **Gather Feedback**: Which approach feels most natural?
3. **Identify Pain Points**: What information is hard to find?
4. **Iterate**: Combine best elements from each prototype
5. **Validate**: Test refined design with users

---

## Notes on Implementation

These prototypes use hardcoded data to demonstrate the design without backend dependencies. They are not linked to the main navigation to prevent confusion with the production case page.

The tooltips throughout the prototypes serve as design documentation—hover over any element to understand its intended purpose and any design decisions made.
