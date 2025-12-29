# CAI Intake - Enterprise-Grade OCR Enhancement Plan

## Current Status ✅ (ALL IMPLEMENTED)

| Component | Current | Target | Status |
|-----------|---------|--------|--------|
| Claude MAX_TOKENS | 16,384 | 16,384 | ✅ Done |
| OpenAI MAX_COMPLETION_TOKENS | 16,384 | 16,384 | ✅ Done |
| Multi-column extraction | Enhanced prompts | Enhanced prompts | ✅ Done |
| Parallel processing | 3 concurrent | 3 concurrent | ✅ Done |
| Content filter handling | Enhanced prompts | Enhanced prompts | ✅ Done |
| Retry with exponential backoff | Implemented | Implemented | ✅ Done |
| Truncation detection | Implemented | Implemented | ✅ Done |
| Response validation (Zod) | Implemented | Implemented | ✅ Done |
| Review flagging | Implemented | Implemented | ✅ Done |
| Audit logging | Implemented | Implemented | ✅ Done |
| Smart chunking (150+ parts) | Implemented | Implemented | ✅ Done |
| Rate limiting | Implemented | Implemented | ✅ Done |
| Quality metrics | Implemented | Implemented | ✅ Done |
| Enhanced fallback chain | Implemented | Implemented | ✅ Done |

## Implemented Enhancements (Completed)

### 1. 🔄 Response Truncation Detection (HIGH PRIORITY)

**Problem**: AI may hit token limits and truncate silently.

**Solution**: Detect incomplete JSON responses.

```typescript
// Detect truncation by checking if JSON is complete
function detectTruncation(response: string, expectedMinParts: number): boolean {
  try {
    const parsed = JSON.parse(response);
    const parts = Array.isArray(parsed) ? parsed : parsed?.parts;
    
    // Check for obvious truncation signs
    if (!response.trim().endsWith(']') && !response.trim().endsWith('}')) {
      return true; // Incomplete JSON
    }
    
    // Check if we got suspiciously few parts
    if (parts?.length < expectedMinParts * 0.5) {
      return true; // Got less than 50% expected
    }
    
    return false;
  } catch {
    return true; // Failed to parse = truncated
  }
}
```

**Action**: Add truncation detection and auto-retry with chunking.

---

### 2. 🔁 Smart Retry with Exponential Backoff (HIGH PRIORITY)

**Problem**: Network issues, rate limits, or transient errors cause failures.

**Solution**: Implement retry logic with exponential backoff.

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (isNonRetryableError(error)) throw error;
      
      const delay = baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}
```

**Action**: Wrap all AI calls with retry logic.

---

### 3. 📊 Part Count Estimation & Verification (HIGH PRIORITY)

**Problem**: No way to verify if all parts were extracted.

**Solution**: Estimate part count before extraction, verify after.

```typescript
interface ExtractionVerification {
  estimatedParts: number;    // From image analysis
  extractedParts: number;    // Actual extracted
  confidence: number;        // Confidence in completeness
  possiblyMissing: boolean;  // Flag for review
  sections: string[];        // Detected sections
}

async function estimatePartCount(image: Buffer): Promise<number> {
  // Quick AI call to count numbered items
  const response = await quickAnalysis(image, 
    "Count ALL numbered items in this image. Return just a number."
  );
  return parseInt(response) || 0;
}
```

**Action**: Add pre-extraction count estimation and post-extraction verification.

---

### 4. 🖼️ Image Segmentation for Large Documents (MEDIUM PRIORITY)

**Problem**: Very dense multi-column documents may overwhelm single-pass OCR.

**Solution**: Detect dense documents and process in segments.

```typescript
interface ImageSegment {
  region: { x: number; y: number; width: number; height: number };
  sectionName?: string;
  priority: number;
}

async function segmentImage(image: Buffer): Promise<ImageSegment[]> {
  // Use AI to identify distinct sections
  // Split into processable chunks
  // Return ordered segments
}
```

**Action**: Implement optional image segmentation for very large documents.

---

### 5. ✅ Structured Response Validation (MEDIUM PRIORITY)

**Problem**: AI may return malformed or unexpected JSON structures.

**Solution**: Strict JSON schema validation with Zod.

```typescript
const PartSchema = z.object({
  row: z.number().optional(),
  label: z.string().optional(),
  length: z.number().positive(),
  width: z.number().positive(),
  quantity: z.number().int().positive().default(1),
  thickness: z.number().positive().default(18),
  material: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  // ... etc
});

const ResponseSchema = z.object({
  parts: z.array(PartSchema).min(1),
});

function validateResponse(raw: string): ValidationResult {
  const parsed = JSON.parse(raw);
  return ResponseSchema.safeParse(parsed);
}
```

**Action**: Add Zod schema validation for all AI responses.

---

### 6. 🎯 Confidence-Based Flagging (MEDIUM PRIORITY)

**Problem**: Low-confidence extractions may contain errors.

**Solution**: Automatic flagging for human review.

```typescript
interface ReviewFlag {
  partIndex: number;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  suggestedAction: string;
}

function flagForReview(parts: Part[]): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  
  for (const [i, part] of parts.entries()) {
    // Low overall confidence
    if (part.confidence < 0.7) {
      flags.push({
        partIndex: i,
        reason: 'Low confidence extraction',
        severity: 'medium',
        suggestedAction: 'Verify dimensions and quantity'
      });
    }
    
    // Suspicious dimensions
    if (part.length > 3000 || part.width > 1500) {
      flags.push({
        partIndex: i,
        reason: 'Unusual dimensions',
        severity: 'low',
        suggestedAction: 'Verify dimensions are in mm'
      });
    }
    
    // High quantity
    if (part.quantity > 50) {
      flags.push({
        partIndex: i,
        reason: 'High quantity',
        severity: 'low',
        suggestedAction: 'Verify quantity is correct'
      });
    }
  }
  
  return flags;
}
```

**Action**: Implement automatic review flagging.

---

### 7. 📝 Detailed Audit Logging (MEDIUM PRIORITY)

**Problem**: Difficult to debug and improve OCR accuracy.

**Solution**: Comprehensive audit trail.

```typescript
interface OCRAuditLog {
  requestId: string;
  timestamp: Date;
  
  // Input
  imageHash: string;
  imageSizeKB: number;
  imageDimensions: { width: number; height: number };
  
  // Processing
  provider: 'claude' | 'gpt';
  modelVersion: string;
  promptTokens: number;
  completionTokens: number;
  processingTimeMs: number;
  
  // Output
  partsExtracted: number;
  avgConfidence: number;
  sectionsDetected: string[];
  
  // Verification
  estimatedParts?: number;
  truncationDetected: boolean;
  validationPassed: boolean;
  reviewFlags: number;
  
  // Errors
  errors: string[];
  retryCount: number;
}
```

**Action**: Implement comprehensive audit logging.

---

### 8. 🔄 Fallback Chain Enhancement (LOW PRIORITY)

**Current**: Claude → GPT fallback

**Proposed**: More sophisticated fallback.

```typescript
const FALLBACK_CHAIN = [
  { provider: 'claude', strategy: 'single-pass' },
  { provider: 'claude', strategy: 'chunked' },
  { provider: 'gpt', strategy: 'single-pass' },
  { provider: 'gpt', strategy: 'chunked' },
  { provider: 'claude', strategy: 'segmented' },
];

async function robustExtraction(image: Buffer): Promise<ExtractionResult> {
  for (const { provider, strategy } of FALLBACK_CHAIN) {
    try {
      const result = await extract(image, provider, strategy);
      if (result.isComplete && result.confidence > 0.8) {
        return result;
      }
    } catch (error) {
      continue;
    }
  }
  throw new Error('All extraction methods failed');
}
```

**Action**: Implement multi-strategy fallback chain.

---

### 9. 🌐 Rate Limit Management (LOW PRIORITY)

**Problem**: Heavy usage may hit API rate limits.

**Solution**: Token bucket rate limiting.

```typescript
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  
  async acquire(cost: number = 1): Promise<void> {
    this.refill();
    
    while (this.tokens < cost) {
      await sleep(100);
      this.refill();
    }
    
    this.tokens -= cost;
  }
}
```

**Action**: Implement rate limiting for high-volume scenarios.

---

### 10. 📈 Accuracy Tracking Dashboard (LOW PRIORITY)

**Problem**: No visibility into OCR accuracy over time.

**Solution**: Track and visualize accuracy metrics.

```typescript
interface AccuracyMetrics {
  period: 'day' | 'week' | 'month';
  totalExtractions: number;
  avgPartsPerExtraction: number;
  avgConfidence: number;
  truncationRate: number;
  fallbackRate: number;
  reviewFlagRate: number;
  userCorrectionRate: number;
}
```

**Action**: Implement accuracy tracking and dashboard.

---

## Implementation Priority

### Phase 1: Critical (Implement Now)
1. ✅ Response Truncation Detection
2. ✅ Smart Retry with Exponential Backoff
3. ✅ Part Count Estimation & Verification

### Phase 2: Important (Next Sprint)
4. Structured Response Validation (Zod)
5. Confidence-Based Flagging
6. Image Segmentation for Large Documents

### Phase 3: Nice to Have (Future)
7. Detailed Audit Logging
8. Fallback Chain Enhancement
9. Rate Limit Management
10. Accuracy Tracking Dashboard

---

## Model Token Limits Reference

| Model | Context Window | Max Output |
|-------|---------------|------------|
| Claude 3.5 Sonnet | 200K tokens | 8K-16K tokens |
| GPT-4o | 128K tokens | 16K tokens |
| GPT-4 Turbo | 128K tokens | 4K tokens |

### Token Calculation
- Average JSON part: ~100-150 tokens
- 100 parts = ~12,000-15,000 tokens
- 150 parts = ~18,000-22,500 tokens (may need chunking)

---

## Configuration Recommendations

```typescript
// Recommended settings for enterprise-grade OCR
const CONFIG = {
  // Token limits (use model max)
  CLAUDE_MAX_TOKENS: 16384,
  GPT_MAX_COMPLETION_TOKENS: 16384,
  
  // Retry settings
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 1000,
  
  // Confidence thresholds
  MIN_CONFIDENCE_AUTO_ACCEPT: 0.85,
  MIN_CONFIDENCE_FLAG_REVIEW: 0.7,
  
  // Truncation detection
  MIN_EXPECTED_PARTS_RATIO: 0.5, // Flag if < 50% expected
  
  // Timeout
  REQUEST_TIMEOUT_MS: 120000, // 2 minutes for large images
  
  // Parallel processing
  MAX_CONCURRENT_FILES: 3,
};
```

---

## Questions for Review

1. **Phase 1 Implementation**: Should we implement truncation detection and retry logic now?
2. **Chunking Strategy**: For very large documents (150+ parts), should we chunk or segment?
3. **Review UI**: Do we need a dedicated review queue for flagged extractions?
4. **Accuracy Baseline**: Should we establish accuracy benchmarks?
5. **Cost Monitoring**: Should we add API cost tracking?

---

*Document created: December 29, 2024*
*Last updated: December 29, 2024*

