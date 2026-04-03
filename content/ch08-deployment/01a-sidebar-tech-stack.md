---
id: ch5-tech-stack
type: spine
title: "The RecSys Technology Stack: An End-to-End View"
readingTime: 4
standalone: true
core: false
teaser: "From event streams to model serving, a production recommender system is a distributed machine learning application spanning dozens of specialized components. Understanding the full stack reveals why recommendation engineering is as much about infrastructure as it is about algorithms."
voice: explorer
parent: null
diagram: null
recallQ: "What are the main layers of a production recommender system's technology stack?"
recallA: "Data layer (event streaming, feature stores, data warehouses), model training (offline pipelines, experiment tracking, hyperparameter tuning), serving layer (model serving, embedding storage, real-time features), and orchestration (ML pipelines, A/B testing, monitoring)."
publishedAt: "2026-04-03"
status: accepted
---

The algorithms you have explored throughout this book -- collaborative filtering, content-based similarity, matrix factorization -- are the mathematical core of a recommender system. But algorithms alone do not produce recommendations. In production, each algorithm lives inside a multi-layered technology stack that ingests raw user behavior, transforms it into features, trains and evaluates models, serves predictions at low latency, and continuously monitors the entire pipeline for degradation.

![The recommendation system technology stack: data, training, serving, orchestration](/images/diagram-recsys-tech-stack.svg)

This sidebar maps the complete stack, layer by layer.

## The Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER REQUEST                             │
│          (click, search, page load, app open)                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY / CDN                             │
│              (rate limiting, authentication)                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌──────────────────┐   ┌──────────────────────────────────────────┐
│  FEATURE LOOKUP  │   │        CANDIDATE GENERATION              │
│  (Feature Store) │   │  (ANN index, pre-filtered pools)        │
│  ~10-20ms        │   │  ~20-50ms                                │
└────────┬─────────┘   └─────────────────┬────────────────────────┘
         │                               │
         └───────────┬───────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SCORING / RANKING                         │
│         (ML model inference on candidates)                      │
│         ~30-80ms                                                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RE-RANKING                               │
│     (business rules, diversity, freshness, fairness)            │
│     ~10-20ms                                                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RESPONSE TO USER                            │
│            (ranked list, total < 200ms)                         │
└─────────────────────────────────────────────────────────────────┘
```

Every component in this diagram is backed by a distinct set of technologies. The following sections walk through each layer.

## Layer 1: Data Ingestion and Storage

Raw user behavior -- clicks, views, purchases, search queries, scroll depth, dwell time -- must be captured, transported, and stored before any model can learn from it. This is the foundation on which everything else rests.

**Event streaming** platforms capture user interactions in real time and deliver them to downstream consumers. The two dominant systems are:

- **Apache Kafka** -- the open-source standard. Kafka provides durable, partitioned, replayable event logs. Most large-scale recommender systems use Kafka as the central nervous system connecting user-facing applications to backend data pipelines. Its consumer-group model allows multiple downstream systems (analytics, feature computation, model training) to independently read from the same stream.
- **Amazon Kinesis** -- the fully managed AWS equivalent. Kinesis Data Streams and Kinesis Data Firehose offer similar semantics with lower operational overhead for teams already committed to the AWS ecosystem. Google Cloud Pub/Sub and Azure Event Hubs serve the same role on their respective platforms.

**Feature stores** bridge the gap between raw event data and the structured inputs that models expect. A feature store computes, stores, and serves feature values -- both historical features for training and real-time features for inference -- ensuring consistency between offline and online environments:

- **Feast** -- open-source, Kubernetes-native. Feast provides a declarative feature definition layer, a batch materialization pipeline (typically backed by Spark or BigQuery), and an online serving API backed by Redis or DynamoDB.
- **Tecton** -- a managed feature platform built by former Uber Michelangelo engineers. Tecton adds real-time feature computation (streaming and on-demand transforms), automated backfills, and monitoring. Designed for teams that need sub-100ms feature freshness.
- **SageMaker Feature Store** (AWS) and **Vertex AI Feature Store** (GCP) offer cloud-native alternatives tightly integrated with their respective ML platforms.

**Data warehouses** store the historical record -- months or years of interaction data, item metadata, user profiles, and experiment results -- used for offline model training and analysis:

- **Google BigQuery** -- serverless, columnar, SQL-native. Handles petabyte-scale analytical queries without cluster management. Deep integration with Vertex AI for ML workflows.
- **Snowflake** -- cloud-agnostic data warehouse with strong data-sharing capabilities. Increasingly popular for organizations running multi-cloud architectures.
- **Amazon Redshift** -- the original cloud data warehouse. Tight integration with the broader AWS ecosystem (S3, SageMaker, Glue).

The choice among these is often driven by existing cloud commitments rather than technical superiority -- all three are capable of supporting production recommender workloads.

## Layer 2: Model Training

Once data is collected and features are computed, models must be trained, evaluated, and selected for deployment. This layer is where the algorithms from this book meet engineering reality.

**Offline training pipelines** process large datasets to produce trained model artifacts:

- **Apache Spark** (via PySpark or Spark MLlib) -- the workhorse for distributed data processing. Spark handles feature engineering at scale, processes billions of interaction records, and supports distributed matrix factorization and ALS (alternating least squares) algorithms natively.
- **PyTorch** -- the dominant framework for deep learning-based recommendation models. Two-tower architectures, sequential models (SASRec, BERT4Rec), and graph neural networks for recommendations are almost universally implemented in PyTorch. Its dynamic computation graph and strong research ecosystem make it the default choice for teams experimenting with novel architectures.
- **TensorFlow** -- still widely used in production, particularly at Google and organizations with existing TF infrastructure. TensorFlow Recommenders (TFRS) provides high-level APIs for retrieval and ranking models. TensorFlow Extended (TFX) offers an end-to-end pipeline framework.

**Experiment tracking** systems record every training run -- hyperparameters, metrics, model artifacts, datasets used -- so that results are reproducible and comparable:

- **MLflow** -- open-source, framework-agnostic. MLflow Tracking logs parameters and metrics, MLflow Models packages artifacts for deployment, and MLflow Registry manages model versioning and stage transitions (staging, production, archived). Widely adopted and well-integrated with Databricks.
- **Weights & Biases (W&B)** -- a managed platform emphasizing visualization and collaboration. W&B provides real-time experiment dashboards, hyperparameter sweep coordination, dataset versioning, and model lineage tracking. Particularly popular in research-oriented teams.

**Hyperparameter tuning** automates the search for optimal model configurations -- learning rate, embedding dimension, regularization strength, number of layers -- across potentially thousands of combinations:

- **Optuna** -- a Python-native framework using sophisticated search algorithms (TPE, CMA-ES). Optuna's pruning mechanism terminates unpromising trials early, dramatically reducing compute costs. Lightweight and easy to integrate with any training script.
- **Ray Tune** -- part of the Ray distributed computing ecosystem. Ray Tune scales hyperparameter search across clusters, supports dozens of search algorithms (Bayesian optimization, population-based training, HyperBand), and integrates natively with PyTorch and TensorFlow. The right choice when tuning requires distributed resources.

## Layer 3: Model Serving and Inference

A trained model is an artifact on disk. The serving layer makes it an API that returns predictions in milliseconds.

**Model serving frameworks** load model artifacts into memory and expose them as high-throughput, low-latency inference endpoints:

- **NVIDIA Triton Inference Server** -- supports models from multiple frameworks (PyTorch, TensorFlow, ONNX, TensorRT) simultaneously. Triton provides dynamic batching (aggregating individual requests into GPU-efficient batches), model ensembles (chaining multiple models in a single request), and A/B model routing. The industry standard for GPU-accelerated inference.
- **TorchServe** -- the official serving solution for PyTorch models. Simpler to set up than Triton, with good support for custom pre/post-processing handlers. Best suited for PyTorch-only deployments.
- **TensorFlow Serving** -- production-grade serving for TensorFlow SavedModels. Tight integration with the TensorFlow ecosystem, gRPC and REST APIs, and automatic model versioning. Mature and battle-tested at Google-scale workloads.

**Embedding storage and approximate nearest neighbor (ANN) search** is critical for the candidate generation stage, where the system must rapidly find the most relevant items from a catalog of millions:

- **FAISS** (Facebook AI Similarity Search) -- an open-source library of GPU-accelerated ANN algorithms. FAISS supports multiple index types (IVF, HNSW, PQ) and can search billion-scale embedding spaces in single-digit milliseconds. The default choice for teams comfortable managing their own infrastructure.
- **Milvus** -- an open-source, distributed vector database built specifically for embedding search at scale. Milvus wraps FAISS-like algorithms in a database interface with support for filtering, hybrid search, and dynamic data updates.
- **Pinecone** -- a fully managed vector database. Pinecone eliminates the operational complexity of running ANN infrastructure, offering a simple API for upsert, query, and metadata filtering. Ideal for teams that want to avoid managing FAISS clusters or Milvus deployments.

**Feature computation at inference time** falls into two categories with very different engineering requirements:

- **Batch features** are precomputed on a schedule (hourly, daily) and stored in the feature store's online tier (typically Redis or DynamoDB). Examples: a user's historical genre distribution, an item's average rating, 7-day click-through rate. These features are cheap to look up but may be stale.
- **Real-time features** are computed on the fly from the event stream at request time. Examples: items viewed in the current session, time since last interaction, number of actions in the past 5 minutes. These features require streaming infrastructure (Kafka Streams, Flink, or Spark Structured Streaming) and add latency and complexity. The payoff is that they capture the user's current intent, which is often the strongest signal available.

Most production systems use a mix of both: batch features for stable, slowly-changing attributes, and real-time features for session-level context.

## Layer 4: Orchestration and Operations

Individual components must be connected into a reliable, automated pipeline that runs without manual intervention.

**ML pipeline orchestrators** manage the end-to-end workflow -- data extraction, feature computation, model training, evaluation, deployment, and monitoring -- as a directed acyclic graph (DAG) of dependent steps:

- **Kubeflow Pipelines** -- Kubernetes-native ML workflow orchestration. Each pipeline step runs as a container, enabling reproducible, portable, and scalable execution. Well-suited for teams with existing Kubernetes infrastructure. Integrates with Kubeflow's broader ML platform (notebooks, training operators, serving).
- **Apache Airflow** -- the general-purpose workflow orchestrator. Airflow's DAG-based model, extensive operator library, and mature ecosystem make it the default choice for data engineering teams. Not ML-specific, but flexible enough to orchestrate any sequence of tasks. Managed offerings include Google Cloud Composer and Amazon MWAA.
- **Vertex AI Pipelines** (GCP), **SageMaker Pipelines** (AWS), and **Azure ML Pipelines** provide cloud-native alternatives with tighter integration into their respective ML platforms.

**A/B testing and experimentation** frameworks allow teams to rigorously evaluate model changes before full rollout:

- **Custom solutions** are the norm at large companies. Netflix, Spotify, and LinkedIn have each built bespoke experimentation platforms tailored to their specific statistical requirements, traffic volumes, and metric hierarchies. These systems handle traffic splitting, metric computation, statistical analysis, and automated decision-making.
- **Optimizely** and **LaunchDarkly** provide managed experimentation and feature flagging platforms. They offer SDKs for server-side traffic splitting, Bayesian and frequentist statistical engines, and integration with analytics platforms. Suitable for organizations that do not want to build experimentation infrastructure from scratch.
- **Eppo** and **Statsig** are newer entrants focused specifically on product experimentation with warehouse-native architectures.

**Monitoring** in a recommender system goes far beyond traditional application monitoring (uptime, error rates, latency). Three additional dimensions are critical:

- **Model drift** -- has the statistical relationship between features and outcomes changed since the model was trained? Distribution shifts in user behavior (seasonal trends, external events, product changes) can silently degrade model quality. Tools like **Evidently AI** and **NannyML** provide automated drift detection.
- **Data quality** -- are features arriving on time, within expected ranges, and without missing values? A silent failure in the feature pipeline (an upstream schema change, a delayed batch job) can corrupt model inputs without triggering any application-level errors. **Great Expectations** and **dbt tests** are widely used for data validation.
- **Latency and throughput** -- is the system meeting its SLA? Recommendation requests typically require an end-to-end response time under 200ms. Standard observability tools (**Prometheus + Grafana**, **Datadog**, **New Relic**) track p50, p95, and p99 latencies across each stage of the request flow.

## The Request Flow: Anatomy of a Recommendation

When a user opens the Netflix homepage or scrolls through Spotify's Discover Weekly, the following sequence executes in under 200 milliseconds:

**1. Request arrival (~5ms)**
The user's client sends a request to the API gateway. The request includes the user ID, device context, and the recommendation surface being requested (home feed, search results, "more like this").

**2. Feature lookup (~10-20ms)**
The serving layer queries the feature store for the user's precomputed features (historical preferences, demographic segment, recent activity summary) and retrieves any real-time features from the streaming layer (current session behavior, time of day).

**3. Candidate generation (~20-50ms)**
Rather than scoring every item in the catalog (millions of items would be computationally prohibitive), the system narrows the field to a manageable candidate set of hundreds to low thousands. This stage typically uses:
- ANN search over user and item embeddings (FAISS/Milvus)
- Multiple retrieval channels: collaborative filtering embeddings, content-based embeddings, trending items, recently interacted items
- Hard filters: region availability, age restrictions, already-seen items

**4. Scoring (~30-80ms)**
A ranking model (typically a deep neural network) scores each candidate. The model ingests user features, item features, and cross-features (user-item interaction history, contextual signals) and outputs a relevance score. GPU-accelerated inference via Triton or TorchServe enables scoring hundreds of candidates in a single batched forward pass.

**5. Re-ranking (~10-20ms)**
Business logic is applied on top of raw model scores:
- **Diversity injection** -- ensure the final list is not dominated by a single genre or content type
- **Freshness boosting** -- promote newly released items
- **Fairness constraints** -- ensure equitable exposure across content creators
- **Deduplication** -- suppress items the user has already seen or interacted with
- **Monetization rules** -- blend organic and sponsored recommendations

**6. Response (~5ms)**
The final ranked list is serialized and returned to the client. The total end-to-end latency must stay under the SLA -- typically 100-200ms for web and mobile applications.

### Latency Budget Breakdown

```
Component              Target     Typical Range
─────────────────────  ─────────  ─────────────
API gateway / routing    5ms       2-10ms
Feature lookup          15ms      10-25ms
Candidate generation    35ms      20-60ms
Model scoring           50ms      30-100ms
Re-ranking              15ms      10-25ms
Serialization / return   5ms       2-10ms
─────────────────────  ─────────  ─────────────
Total                  125ms      75-230ms
SLA target             <200ms
```

Exceeding the latency budget on any single component forces trade-offs: fewer candidates, a simpler model, precomputed re-ranking rules, or cached responses for repeat visits.

## Cloud-Specific Reference Architectures

Each major cloud provider offers an integrated stack for building recommender systems. The core concepts are identical; the service names differ.

**AWS:**
Kinesis (streaming) → S3 + Glue (data lake) → Redshift (warehouse) → SageMaker Feature Store (features) → SageMaker (training) → SageMaker Endpoints / Triton on EKS (serving) → CloudWatch (monitoring)

**Google Cloud:**
Pub/Sub (streaming) → Cloud Storage + Dataflow (data lake) → BigQuery (warehouse) → Vertex AI Feature Store (features) → Vertex AI Training (training) → Vertex AI Prediction / GKE (serving) → Cloud Monitoring (monitoring)

**Azure:**
Event Hubs (streaming) → Azure Data Lake + Data Factory (data lake) → Synapse Analytics (warehouse) → Azure ML Feature Store (features) → Azure ML (training) → Azure ML Endpoints / AKS (serving) → Azure Monitor (monitoring)

Many production systems are multi-cloud or hybrid, using best-of-breed components from different providers -- for example, Snowflake for the warehouse, Databricks for training, and a self-managed FAISS cluster on Kubernetes for embedding search.

## Why the Stack Matters

It is tempting to focus exclusively on the algorithm -- to view recommendation as a mathematical problem that is solved once the right formula is found. In practice, the algorithm accounts for a modest fraction of the overall engineering effort. Google's famous "Hidden Technical Debt in Machine Learning Systems" paper estimated that the ML model code represents roughly 5% of a production ML system's codebase. The remaining 95% is configuration, data collection, feature extraction, data verification, serving infrastructure, monitoring, and process management.

Understanding the full stack is what separates a prototype that works on a laptop from a system that serves millions of users reliably, adapts to shifting behavior in real time, and improves continuously through disciplined experimentation.
