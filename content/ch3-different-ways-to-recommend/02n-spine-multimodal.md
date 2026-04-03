---
id: ch3-multimodal
type: spine
title: "Multimodal Recommendation: Beyond Text and Clicks"
readingTime: 3
standalone: true
core: true
voice: universal
status: accepted
---

A product listing has a title, a photograph, maybe a video review, and thousands of behavioral signals from users who browsed, clicked, and purchased it. Traditional recommender systems pick one of these signals -- typically user behavior or text metadata -- and ignore the rest. **Multimodal recommendation** uses all of them simultaneously, building a richer understanding of items than any single data source can provide.

## What Are Modalities?

A **modality** is a distinct type of information that describes an item or captures user behavior. The most common modalities in recommendation systems:

- **Text**: Titles, descriptions, reviews, tags, plot summaries. The most readily available modality -- nearly every item has some textual description.
- **Images**: Product photos, movie posters, album artwork, user-uploaded pictures. Visual appearance carries preference signals that text often fails to capture: the aesthetic of a dress, the atmosphere of a hotel room, the visual style of a video game.
- **Audio**: Music tracks, podcast episodes, sound effects in games. Audio carries information about mood, energy, tempo, instrumentation -- qualities that are difficult to encode in metadata.
- **Video**: Trailers, product demonstrations, user-generated clips. Video combines visual and temporal information, capturing narrative structure, pacing, and style.
- **User behavior**: Click sequences, purchase histories, dwell times, scroll patterns, ratings. This is the modality that collaborative filtering has always exploited.
- **Metadata**: Structured attributes like genre, price, release date, creator, brand, dimensions. Reliable and clean, but limited in expressiveness.

Each modality reveals something different. A book's cover design signals its genre to browsing shoppers. Its text description conveys plot and themes. Its reading behavior patterns reveal which audiences actually enjoy it. No single modality tells the full story.

## Why Go Multimodal?

Two problems drive the adoption of multimodal methods.

**Richer item understanding.** A purely text-based system knows that two dresses are both described as "elegant evening wear." A system that also processes images can see that one is a minimalist black sheath and the other is a sequined ball gown -- visually and stylistically distinct despite identical text descriptions. Adding modalities adds discriminative power.

**Better cold-start handling.** When a new item arrives with zero interaction history, collaborative filtering has nothing to work with. But the item still has a title, an image, perhaps an audio preview. Multimodal systems can position the new item in the recommendation space immediately, based on its content features alone. This is the cold-start advantage that content-based methods have always held -- multimodal systems extend it across all available content types simultaneously.

## Text Features: From Bag-of-Words to Transformers

The evolution of text representation in recommendation mirrors the broader trajectory of NLP:

**TF-IDF** (Term Frequency--Inverse Document Frequency) represents items as sparse vectors where each dimension corresponds to a word, weighted by how distinctive that word is across the catalog. Simple, interpretable, and surprisingly effective for keyword-level similarity. But it treats every word as independent -- "machine learning" is just two unrelated dimensions.

**Word2Vec** (Mikolov et al., 2013) introduced dense, learned word embeddings where semantically related words occupy nearby positions in vector space. For recommendations, item descriptions could be represented as averages of their word vectors, capturing some semantic similarity. But averaging loses word order and nuance.

**BERT** (Devlin et al., 2019) and its successors brought contextual embeddings -- the same word gets different representations depending on its surrounding context. "Bank" in "river bank" and "investment bank" produces different vectors. For recommendation, BERT can encode item descriptions into rich representations that capture meaning, not just keywords.

**Sentence Transformers** (Reimers & Gurevych, 2019) fine-tuned BERT-style models specifically for producing high-quality sentence and paragraph embeddings, making it practical to compute semantic similarity between item descriptions at scale. These are now the standard text encoding backbone in production multimodal systems.

## Image Features: From CNNs to CLIP

Visual representation has undergone its own revolution:

**CNN features.** Convolutional Neural Networks trained on ImageNet (notably **ResNet**, He et al., 2016) learn hierarchical visual features: edges and textures in early layers, object parts in middle layers, and semantic concepts in deep layers. Extracting the penultimate layer's activation vector gives a dense representation of visual content. Early visual recommendation systems used these features to compute image similarity -- products that look alike get recommended together.

**CLIP embeddings** (Radford et al., 2021) changed the game by training a vision model and a language model jointly on 400 million image-text pairs from the internet. CLIP maps images and text into a **shared embedding space** where an image of a red dress and the phrase "red dress" occupy nearby positions. This cross-modal alignment is transformative for recommendation: it means you can search for items using text queries and get visually relevant results, or find items that match both a textual description and a visual style simultaneously.

Visual similarity often correlates with user preference in ways that metadata cannot capture. Two chairs might share the same category, material, and price range, but one has mid-century modern lines and the other has industrial styling. Users who prefer one aesthetic consistently prefer it -- and image features capture this signal.

## Audio Features: Hearing What Metadata Cannot Say

Music and audio recommendation benefit enormously from processing the audio signal directly:

**Mel spectrograms** convert audio waveforms into visual representations of frequency content over time. These 2D representations can be fed through CNNs (the same architectures used for images), enabling the extraction of features like timbre, rhythm patterns, and harmonic structure directly from the raw audio.

**Audio embeddings** from models trained on large music corpora capture high-level musical properties: mood, energy, danceability, instrumentation, and vocal characteristics. These learned representations position songs in a space where musically similar tracks cluster together, regardless of genre labels.

**Spotify's audio analysis** is a production example. Spotify extracts detailed acoustic features for every track in its catalog -- tempo, key, loudness, speechiness, acousticness, instrumentalness, valence (musical positivity), and energy. These features feed into recommendation models alongside collaborative filtering signals. A user who consistently listens to high-energy, major-key tracks with strong beats gets recommendations that match this acoustic profile, even for artists and genres they have never explored. The audio modality enables cross-genre discovery that metadata-based systems struggle with.

## Fusion Strategies: Combining Modalities

The central engineering question in multimodal recommendation is how to combine information from different modalities. Three strategies dominate, each with distinct trade-offs.

### Early Fusion: Concatenate Before the Model

Extract feature vectors from each modality independently (text embedding, image embedding, audio embedding), then **concatenate** them into a single long vector that serves as input to the recommendation model.

A text embedding of dimension 768, an image embedding of dimension 2048, and an audio embedding of dimension 512 become a single 3328-dimensional input vector. The model learns to weight and combine features from all modalities jointly.

**Advantages**: The model can learn cross-modal interactions -- for instance, that a dark album cover (image) combined with lyrics about loss (text) predicts preference for a specific user cluster. All modality interactions are potentially discoverable.

**Disadvantages**: The concatenated vector is high-dimensional and can be dominated by the modality with the largest embedding. Missing modalities (an item with no image) require careful handling -- typically zero-padding or learned default vectors. The model must learn cross-modal interactions from scratch, which demands substantial training data.

### Late Fusion: Separate Models, Combined Predictions

Train a **separate recommendation model for each modality** -- one that uses text features, one that uses image features, one that uses behavioral data. Each model produces its own relevance score. The final prediction is a weighted combination of these per-modality scores.

**Advantages**: Each model can be optimized independently for its modality. Missing modalities are handled naturally -- if no image is available, the image model simply doesn't contribute. Individual models can be updated or replaced without retraining the entire system. Debugging is easier because you can inspect each modality's contribution.

**Disadvantages**: Cross-modal interactions are invisible to each individual model. The text model cannot learn that a particular visual style modifies the meaning of a text description. The combination weights must be tuned, and optimal weights may vary across users, items, and contexts.

### Cross-Modal Attention: Modalities Attend to Each Other

The most expressive approach uses **attention mechanisms** to let each modality selectively attend to relevant parts of other modalities. When processing a product's text description, the model can attend to specific regions of the product image that are most relevant to particular words. When processing the image, it can attend to the most visually relevant parts of the description.

Transformer-based architectures naturally support this through cross-attention layers, where queries come from one modality and keys/values come from another. This enables the model to learn fine-grained cross-modal correspondences: the word "floral" in a dress description attends to the flower pattern in the image; the word "matte" attends to the surface texture.

**Advantages**: Captures rich, fine-grained cross-modal interactions. Can learn which parts of each modality are relevant given information from other modalities. State-of-the-art performance on benchmarks.

**Disadvantages**: Computationally expensive, both in training and inference. Requires paired multimodal data for training (items with both text and images). Attention patterns can be difficult to interpret at scale.

## beeFormer: Multimodal Embeddings for Recommendation

**beeFormer** (Kasalicky et al., 2024) demonstrates a particularly elegant approach to multimodal recommendation. It adapts Sentence Transformer models to produce recommendation-quality embeddings from item content -- text, images, or both.

The key insight: standard text and image embeddings (from BERT, CLIP, etc.) are trained for general-purpose semantic similarity. "Similar meaning" does not always equal "similar preference." Two technical textbooks might be semantically similar but appeal to completely different audiences. beeFormer fine-tunes multimodal encoders on user interaction data, learning to produce embeddings where proximity reflects **behavioral similarity** (items consumed by the same users) rather than just semantic similarity.

The result is a system that can encode a new item's text and images into the recommendation embedding space without any interaction history -- addressing the cold-start problem with content-aware embeddings that are aligned with actual user preferences.

## CLIP for Recommendation: Visual Similarity Meets User Preference

CLIP's shared vision-language embedding space has proven remarkably useful for recommendation beyond its original design:

- **Visual search as recommendation**: "Show me more items that look like this one" becomes a nearest-neighbor search in CLIP's image embedding space. Pinterest's visual search uses this principle extensively.
- **Text-to-item retrieval**: A user describes what they want in natural language, and the system retrieves items whose images match the description. This bridges the gap between search and recommendation.
- **Cross-modal candidate generation**: Items can be retrieved based on visual similarity to items the user has previously engaged with, even when those items lack sufficient interaction data for collaborative filtering.

The correlation between visual similarity and preference is domain-dependent. In fashion, home decor, and food, visual similarity is a strong preference signal. In books, electronics, or software, it is weaker. Effective multimodal systems learn to weight the visual modality appropriately for their domain.

## Real-World Multimodal Systems

**Pinterest** operates one of the most sophisticated multimodal recommendation systems in production. Its visual discovery engine combines image embeddings (for visual similarity), text embeddings (from pin descriptions and board titles), and collaborative signals (from saves, clicks, and close-ups) to power related pin recommendations, visual search, and the home feed. When you search for "modern kitchen design," the system retrieves pins that are both textually relevant and visually coherent -- white countertops, clean lines, specific lighting aesthetics -- because the image modality captures design qualities that text cannot express.

**Spotify** blends multiple modalities for music recommendation. Collaborative filtering captures preference patterns from listening history. Audio features (extracted from the raw waveform) capture acoustic properties. Natural language processing of reviews, articles, and social media mentions captures cultural context and sentiment. The combination enables Spotify to recommend a newly released track by an unknown artist -- zero collaborative signal -- based on its acoustic similarity to tracks the user already loves, contextualized by NLP-derived genre and mood signals.

**Netflix** uses trailer and video embeddings as a recommendation signal. By processing movie and show trailers through video understanding models, Netflix extracts features that capture pacing, visual tone, cinematographic style, and narrative structure. These features complement traditional metadata and viewing behavior signals, particularly for new releases where viewing data is sparse. Netflix also famously selects which **artwork** to display for each title based on a multimodal understanding of both the content and the user's visual preferences.

## The Challenge: Modality Alignment

Different modalities live in fundamentally different representation spaces. A text embedding captures semantic meaning in a 768-dimensional space trained on language modeling objectives. An image embedding captures visual features in a 2048-dimensional space trained on image classification. An audio embedding captures acoustic properties in yet another space with different geometry and semantics.

**Modality alignment** is the challenge of bringing these heterogeneous representations into a shared space where cross-modal relationships are meaningful. CLIP solved this for images and text by training both encoders jointly with a contrastive objective. But aligning three or more modalities simultaneously is an open research problem, and the quality of alignment directly affects the quality of cross-modal recommendations.

Misalignment leads to pathological behavior. If the text and image spaces are poorly aligned, the system might recommend a product because its description matches a query while its visual appearance is completely wrong -- or vice versa. Production systems invest heavily in alignment quality, often through auxiliary training objectives that enforce cross-modal consistency.

## The Future: New Modalities, New Possibilities

The frontier of multimodal recommendation is expanding to modalities that were previously computationally intractable:

- **Video understanding**: Moving beyond keyframe extraction to temporal modeling of full video content. Understanding narrative arcs, pacing, and visual storytelling in movies and TV shows -- not just what objects appear, but how the story unfolds.
- **Voice-based preferences**: As voice assistants become primary interfaces, the way a user phrases a request carries preference signal. Hesitation, enthusiasm, specificity of vocabulary -- these paralinguistic cues can inform recommendations.
- **Sensor data**: Wearable devices generate continuous streams of biometric data -- heart rate, movement patterns, sleep quality. A fitness app could recommend workouts based on current physiological state, not just past preferences.
- **3D and spatial data**: As augmented reality matures, spatial understanding of products (how a couch looks in your living room, how a dress fits your body shape) becomes a new modality for recommendation.

The trajectory is clear: every signal that carries information about item characteristics or user state is a potential modality. The systems that learn to fuse these signals effectively will deliver recommendations that feel less like database lookups and more like genuine understanding of what a person wants, in all its multidimensional complexity.
