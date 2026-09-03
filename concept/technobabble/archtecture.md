# archtecture

## system overview

```mermaid
graph TB
    subgraph gui [gui (primary interface)]
        PC[persona cards]
        KG[knowledge graph<br/>d3]
        TB[tag browser<br/>ao3-style]
        ME[memory explorer]
        PM[permissions matrix]
        SF[sharing flow diagram]
        RL[retrieval log]
        DD[decay dashboard]
    end

    subgraph core [core engine]
        IDX[indexing service]
        RET[retrieval pipeline<br/>7-step, 6 signals]
        DCY[decay service]
        TW[tag wrangler]
        SBX[sandbox enforcer]
    end

    subgraph stores [data stores]
        FB[falkordb<br/>graph: nodes, edges, tags]
        PG[supabase/postgres<br/>metadata, permissions, sharing]
        ST[storage<br/>multimodal files]
        VEC[vector store<br/>mem0 / pgvector]
    end

    subgraph adapters [adapters (stack-agnostic)]
        SA[storage adapter]
        VA[vector adapter]
    end

    PC --> IDX
    KG --> RET
    TB --> TW
    ME --> IDX
    PM --> SBX
    SF --> SBX
    RL --> RET
    DD --> DCY

    IDX --> SA
    RET --> SA
    RET --> VA
    DCY --> SA
    TW --> SA
    SBX --> SA

    SA --> FB
    SA --> PG
    SA --> ST
    VA --> VEC
```

## retrieval pipeline architecture

```mermaid
flowchart LR
    Q[query + persona context] --> SS[1. semantic search<br/>15%]
    Q --> TM[2. tag match<br/>30%]
    Q --> HB[3. hierarchy boost<br/>10%]
    Q --> IW[4. identity weight<br/>10%]
    Q --> PR[5. persona relevance<br/>20%]
    Q --> SC[6. source confidence<br/>15%]

    SS --> COMB[7. weighted combination]
    TM --> COMB
    HB --> COMB
    IW --> COMB
    PR --> COMB
    SC --> COMB

    COMB --> GATE{confidence gate}
    GATE -->|"≥ 0.75"| CONF[confident<br/>return results]
    GATE -->|"≥ 0.45"| UNC[uncertain<br/>return with caveat]
    GATE -->|"≥ 0.25"| CLAR[needs clarification<br/>ask user]
    GATE -->|"< 0.25"| UNAVL[unavailable<br/>i don't know]

    CONF --> LOG[retrieval log]
    UNC --> LOG
    CLAR --> LOG
    UNAVL --> LOG
```

## memory indexing flow

```mermaid
flowchart TB
    SRC[source<br/>transcript / user / inference / shared] --> EXT[extract facts]
    EXT --> ASN[assign to perspective]
    ASN --> TAG[assign tags]
    TAG --> WRA[tag wrangling<br/>canonicalize]
    WRA --> WT[assign weight<br/>0-1, identity core]
    WRA --> HY[assign hierarchy<br/>0-1, behavior drive]
    WRA --> CF[assign confidence<br/>0-1]
    WT --> ASC[auto-associate<br/>shared tags, category, temporal]
    HY --> ASC
    CF --> ASC
    ASC --> STORE[store]
    STORE --> FB[(falkordb<br/>graph)]
    STORE --> PG[(postgres<br/>metadata)]
    STORE --> VEC[(vector store<br/>embedding)]
    STORE --> FS[(file storage<br/>multimodal)]
```

## persona pov switching

```mermaid
stateDiagram-v2
    [*] --> Global: system starts<br/>global self loaded
    Global --> PersonaA: user selects perspective A
    Global --> PersonaB: user selects perspective B
    Global --> PersonaC: user selects perspective C

    PersonaA --> PersonaB: rapid pov switch
    PersonaB --> PersonaA: rapid pov switch
    PersonaA --> PersonaC: rapid pov switch
    PersonaC --> Global: back to global

    note right of PersonaA
        sandboxed:
        - own memory
        - own permissions
        - own behavior config
        - own tag relevance
    end note

    note right of PersonaB
        no access to A or C
        unless sharing rules
        explicitly configured
    end note
```

## sandbox enforcement flow

```mermaid
flowchart TB
    REQ[retrieval request<br/>persona A, query Q] --> CHK1{memory in<br/>A's sandbox?}
    CHK1 -->|yes| ALLOW[allow]
    CHK1 -->|no| CHK2{memory in<br/>B's sandbox?}
    CHK2 -->|yes| CHK3{sharing rule<br/>B → A exists?}
    CHK2 -->|no| CHK4{memory in<br/>C's sandbox?}
    CHK3 -->|no| DENY1[deny<br/>no sharing rule]
    CHK3 -->|yes| CHK5{condition met?<br/>tags, category, min weight}
    CHK5 -->|no| DENY2[deny<br/>condition not met]
    CHK5 -->|yes| ALLOW
    CHK4 -->|yes| CHK6{sharing rule<br/>C → A exists?}
    CHK4 -->|no| DENY3[deny<br/>not found]
    CHK6 -->|no| DENY4[deny<br/>no sharing rule]
    CHK6 -->|yes| CHK7{condition met?}
    CHK7 -->|no| DENY5[deny<br/>condition not met]
    CHK7 -->|yes| ALLOW

    ALLOW --> LOG[log to sandbox_access_log<br/>result: allowed, rule_id]
    DENY1 --> LOG2[log to sandbox_access_log<br/>result: denied, reason]
    DENY2 --> LOG2
    DENY3 --> LOG2
    DENY4 --> LOG2
    DENY5 --> LOG2
```

## data model

```mermaid
erDiagram
    memory_nodes ||--o{ memory_associations : "source"
    memory_nodes ||--o{ memory_associations : "target"
    memory_nodes }o--o{ canonical_tags : "tagged with"
    canonical_tags ||--o{ tag_aliases : "has"
    canonical_tags ||--o{ tag_associations : "source"
    canonical_tags ||--o{ tag_associations : "target"
    canonical_tags ||--o{ tag_exclusions : "excludes"
    canonical_tags ||--o{ tag_persona_relevance : "relevance per persona"
    memory_nodes ||--|| multimodal_content : "may have"
    personas ||--|| persona_permissions : "has"
    personas ||--o{ persona_sharing : "shares from"
    personas ||--o{ persona_sharing : "shares to"
    memory_nodes ||--o{ memory_retrieval_confidence : "retrieved by"
    personas ||--o{ sandbox_access_log : "accesses"

    memory_nodes {
        text id PK
        text perspective_id FK
        text parent_id FK
        text key
        text value
        text category
        float weight "0-1 identity core, no decay"
        float hierarchy "0-1 behavior drive, decays"
        float confidence "0-1 accuracy"
        text tags "wrangled canonical tags"
        text content_type "text/image/pdf/code/audio/video"
        text content_url
        json content_metadata
        text source
        text source_meeting_id
        int recall_count
        timestamp last_recalled
        float decay_rate
    }

    canonical_tags {
        text id PK
        text canonical "unique"
        text description
        text parent_tag_id FK
        text category
        float weight "default for tagged memories"
        boolean is_active
    }

    personas {
        text id PK
        text name
        text display_name
        text email
        text context
        text tone
        text initiative_level
        text question_style
        text voice_id
        text language_preference
    }
```

## storage adapter architecture

```mermaid
graph TB
    subgraph core [memorium core (stack-agnostic)]
        CORE[core engine<br/>indexing, retrieval, decay, wrangling]
        IFC[storage interface<br/>CRUD + query contract]
    end

    subgraph adapters [adapters (you implement for your stack)]
        PA[postgres adapter]
        SA[sqlite adapter]
        FA[falkordb adapter]
        RA[redis adapter]
        SUP[supabase adapter]
    end

    subgraph vectors [vector adapters]
        MA[mem0 adapter]
        PV[pgvector adapter]
        PI[pinecone adapter]
        WE[weaviate adapter]
    end

    CORE --> IFC
    IFC --> PA
    IFC --> SA
    IFC --> FA
    IFC --> RA
    IFC --> SUP
    CORE --> IFC
    IFC --> MA
    IFC --> PV
    IFC --> PI
    IFC --> WE
```

## gui component architecture

```mermaid
graph TB
    subgraph gui [memorium gui]
        SHELL[app shell<br/>persona selector + navigation]

        subgraph persona_view [persona view]
            CARDS[persona cards<br/>identity, memory count, weight/hierarchy]
            DETAIL[persona detail<br/>memory explorer, config, permissions]
        end

        subgraph graph_view [knowledge graph view]
            GRAPH[d3 force-directed graph<br/>nodes = memories, edges = associations]
            NODE[node detail panel<br/>tags, source, confidence, last recall]
            FILTERS[filter controls<br/>tag, weight range, hierarchy range, content type]
        end

        subgraph tag_view [tag management view]
            TAGTREE[canonical tag tree<br/>parent/child hierarchy]
            TAGEDIT[tag editor<br/>create, merge, alias, exclude, associate]
            TAGSEARCH[fuzzy tag search]
        end

        subgraph perm_view [permissions + sharing view]
            MATRIX[permissions matrix<br/>personas × sources]
            FLOW[sharing flow diagram<br/>arrows between personas]
            RULES[sharing rule editor<br/>direction, tags, category, min weight]
        end

        subgraph trans_view [transparency view]
            RLOG[retrieval log<br/>every query, every score]
            EXPAND[score breakdown<br/>6 signals expanded]
            SLOG[sandbox access log<br/>allowed + denied access attempts]
        end

        subgraph decay_view [decay view]
            DASH[decay dashboard<br/>hierarchy over time]
            REINFORCE[manual reinforcement<br/>reset decay, boost hierarchy]
            CONFIG[decay rate config<br/>per persona]
        end
    end

    SHELL --> CARDS
    SHELL --> GRAPH
    SHELL --> TAGTREE
    SHELL --> MATRIX
    SHELL --> RLOG
    SHELL --> DASH

    CARDS --> DETAIL
    GRAPH --> NODE
    GRAPH --> FILTERS
    TAGTREE --> TAGEDIT
    TAGTREE --> TAGSEARCH
    MATRIX --> FLOW
    FLOW --> RULES
    RLOG --> EXPAND
    RLOG --> SLOG
    DASH --> REINFORCE
    DASH --> CONFIG
```

## cross-domain associativity graph

```mermaid
graph LR
    subgraph domain_a [domain a: software engineering]
        node_a1[code refactoring]
        node_a2[technical debt accumulation]
    end

    subgraph domain_b [domain b: horticulture & gardening]
        node_b1[tree pruning & thinning]
        node_b2[overgrown root system]
    end

    subgraph bridge [bridging mechanism]
        tag_match[shared canonical tag: maintenance]
        sem_vec[semantic vector cosine similarity]
        metaphor[metaphor detection engine]
    end

    node_a1 --> tag_match --> node_b1
    node_a2 --> sem_vec --> node_b2
    node_a1 --> metaphor --> node_b1
```

## typed associations er diagram

```mermaid
erDiagram
    memory_nodes ||--o{ memory_associations : "source_node"
    memory_nodes ||--o{ memory_associations : "target_node"
    memory_associations ||--o{ association_visibility : "visibility_overrides"
    personas ||--o{ association_visibility : "scoped_for"

    memory_associations {
        text id PK
        text source_node_id FK
        text target_node_id FK
        text association_type "caused_by, example_of, contrasts_with, etc"
        float strength "0.0 to 1.0"
        boolean is_negative "true if disassociation"
        boolean is_bidirectional
    }

    association_visibility {
        text id PK
        text association_id FK
        text persona_id FK
        boolean can_see "edge visibility flag"
        float custom_strength "persona override strength"
    }
```

## temporal memory state machine

```mermaid
stateDiagram-v2
    [*] --> discovered: memory node extracted
    discovered --> active: validated or recalled
    active --> dormant: valid_until passed or inactive
    dormant --> active: recalled or manually reactivated
    active --> abandoned: invalidated or low confidence
    dormant --> abandoned: threshold exceeded without recall
    abandoned --> [*]
```

## contradiction handling flow

```mermaid
flowchart TB
    in_mem[incoming memory claim] --> detect_comp{contradiction detector}
    detect_comp -->|no conflict| normal_idx[index normally]
    detect_comp -->|conflict detected| preserve[preserve existing memory node]
    preserve --> create_claim[create competing claim node]
    create_claim --> link_contrast[link with contrasts_with edge type]
    link_contrast --> calc_temp[assign temporal validity & confidence]
    calc_temp --> check_delta{confidence delta small?}
    check_delta -->|yes| flag_gui[flag competing claims for user review]
    check_delta -->|no| rank_conf[rank priority by calculated confidence]
```

## provenance + lineage chain

```mermaid
flowchart LR
    subgraph provenance_layer [provenance tracking]
        src[source document / transcript] --> prov[provenance metadata: source_type, source_id, source_date]
    end

    subgraph lineage_layer [memory lineage linked list]
        root_fact[root fact node] -->|derived_from| infer_node[inferred preference node]
        infer_node -->|derived_from| action_node[active constraint / goal node]
    end

    prov --> root_fact
    action_node --> exp_query[lineage query: why is this relevant?]
```

## ephemeral memory promotion pipeline

```mermaid
flowchart TB
    working[working tier: ram / single turn] -->|turn end & flagged| session[session tier: ephemeral session db]
    session -->|session end & importance >= 0.4| candidate[candidate tier: 7-day ttl db]
    candidate -->|importance >= 0.7 OR recall_count >= 3| persistent[persistent tier: graph database]
    candidate -->|ttl expires without meeting criteria| purge[purged automatically]
```

## associative retrieval modes

```mermaid
flowchart TB
    q_in[retrieval request] --> mode_bitmask{retrieval_mode bitmask}
    mode_bitmask -->|exact| mode_exact[exact key search]
    mode_bitmask -->|semantic| mode_sem[vector similarity search]
    mode_bitmask -->|hierarchical| mode_hier[parent-child scope tree]
    mode_bitmask -->|associative| mode_assoc[multi-hop edge traversal]
    mode_bitmask -->|temporal| mode_temp[temporal validity filter]
    mode_bitmask -->|causal| mode_causal[caused_by & prerequisite_for graph]
    mode_bitmask -->|persona_aware| mode_pers[persona filter & edge visibility]
    mode_bitmask -->|tag_aware| mode_tag[tag wrangler expansion]
    mode_bitmask -->|graph_traversal| mode_graph[attenuated graph traversal]

    mode_exact --> combiner[results ranker & threshold gate]
    mode_sem --> combiner
    mode_hier --> combiner
    mode_assoc --> combiner
    mode_temp --> combiner
    mode_causal --> combiner
    mode_pers --> combiner
    mode_tag --> combiner
    mode_graph --> combiner
```

## association permissions check flow

```mermaid
flowchart TB
    trav_req[traversal reaches edge e] --> check_src{persona p can see source node?}
    check_src -->|no| block_edge[block edge traversal]
    check_src -->|yes| check_tgt{persona p can see target node?}
    check_tgt -->|no| block_edge
    check_tgt -->|yes| check_assoc_vis{association_visibility table query}
    check_assoc_vis -->|can_see = false| block_edge
    check_assoc_vis -->|can_see = true or no entry| allow_edge[allow edge traversal]
```
