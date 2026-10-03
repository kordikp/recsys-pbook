---
id: recommendation-presentation
type: spine
title: "Presenting Recommendations: Same List, Different Results"
readingTime: 3
standalone: true
core: false
teaser: "Where a row sits, how many tiles fit and what its label says can move results as much as a new model, and they decide what the next model learns."
parent: null
diagram: diagram-presentation-levers-loop
recallQ: "Name two presentation choices that change a recommender's results without changing the model, and explain why they also affect the training data."
recallA: "For example placement and slot count, or the row label and artwork. They change which items get seen and clicked. The model learns from those clicks, and people click high positions partly because they are high (position bias), so the layout leaks into the next model unless each impression's position is logged and accounted for in training."
highlights:
  - "Placement, slot count, row label, artwork and feedback controls are levers a product team controls without touching the model"
  - "People click top positions partly because they are on top (position bias), so click logs record the layout as well as taste"
  - "Log where every item was shown, and let training account for it, or the layout trains the next model"
  - "Test one presentation change at a time, and never in the same test as a model change"
status: draft
concept: recommendation-presentation
conceptTitle: "Presenting recommendations"
parents: scenarios|feedback-signals
state: edited
lens: media
lang: en
depth: standard
formalism: none
visuality: balanced
lengthBand: deep
genre: explainer
carriers: prose|diagram
---

A streaming service spends a quarter on a better ranking model: plays from the home screen go up 0.5%. Then a designer moves the "Recommended for you" row from sixth place to second and renames it "Because you watched *Dark*". Plays go up 3% (illustrative numbers). Nobody touched the algorithm, and the data scientists took it well. Mostly.

Everything between the ranked list and the viewer's eyes is the **presentation layer**, and it is part of the recommender. Five levers sit with the product team:

- **Placement.** Home screen, product page, cart, the screen after an episode ends. Netflix has described homepages of about 40 rows with up to 75 titles each, and members who lose interest after 60 to 90 seconds of browsing. A row nobody scrolls to might as well not exist.
- **Slot count.** Four visible tiles on a phone and seven on a TV are two different recommenders, even with the same model behind them.
- **Row label.** "Because you watched *Dark*" tells viewers why the row exists; "Recommended for you" tells them nothing. A label is a one-line [explanation](#c/explanations), and you can A/B test labels like models.
- **Artwork.** Netflix chooses which image to show per member: a fan of romances may see *Good Will Hunting* with Matt Damon and Minnie Driver, a comedy fan the version with Robin Williams.
- **Feedback controls.** A cheap "Not interested" gives a negative [signal](#c/feedback-signals) the system would otherwise guess from silence, but only if the button acts. In Mozilla's 2022 study of over 20,000 YouTube users, "Not interested" prevented just 11% of unwanted recommendations.

**What the model learns.** Models learn from clicks, and clicks follow the layout. In an eye-tracking study, researchers swapped Google's top two results, and people still clicked the first link far more often, even when the second was the more relevant one. In recommenders this is **position bias**: items on top get clicked partly *because* they are on top. If the logs only say "clicked" or "not clicked", the next model learns that whatever you showed first was good, and the layout feeds itself back into training.

The fix is to record every **impression** (an item shown to someone) with where it was shown: position, row, device. YouTube's ranking team feeds position into a small side part of its model during training and leaves it out when ranking, so the main part learns what people like rather than where things stood. They also found that position bias differs between devices.

**Test one change at a time.** A redesign that moves the row, renames it and swaps the artwork can win an [A/B test](#c/ab-testing) without telling you which change did it. Keep model changes and layout changes in separate tests, or the new model gets credit for the new label.

Before asking for a better model, look at what the viewer sees: where, how many, under what name, and how to say no. **The interface decides what data your next model learns from.**

**Sources:**
- Chandrashekar, A., Amat, F., Basilico, J. & Jebara, T. (2017). Artwork Personalization at Netflix. Netflix Technology Blog. https://netflixtechblog.com/artwork-personalization-c589f074ad76
- Gomez-Uribe, C. A. & Hunt, N. (2015). The Netflix Recommender System: Algorithms, Business Value, and Innovation. *ACM TMIS* 6(4). https://doi.org/10.1145/2843948 (rows per homepage, 60–90 seconds; summarized in New America, *Why Am I Seeing This?*, https://www.newamerica.org/oti/reports/why-am-i-seeing-this/case-study-netflix/)
- Mozilla Foundation (2022). Does This Button Work? Investigating YouTube's ineffective user controls. https://www.mozillafoundation.org/en/youtube/user-controls/ (22,722 participants; reported in TechCrunch, https://techcrunch.com/?p=2402640)
- Joachims, T., Granka, L., Pan, B., Hembrooke, H., Radlinski, F. & Gay, G. (2007). Evaluating the Accuracy of Implicit Feedback from Clicks and Query Reformulations in Web Search. *ACM TOIS* 25(2). https://doi.org/10.1145/1229179.1229181
- Zhao, Z. et al. (2019). Recommending What Video to Watch Next: A Multitask Ranking System. *RecSys '19*. https://doi.org/10.1145/3298689.3346997
