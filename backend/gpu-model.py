# GPU TinyLlama MCQ Generator - Enhanced with GPU Support (No Accelerate)
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
import pdfplumber
import torch
import tempfile
import json
import re
import os
import random
from collections import Counter


# ========== FASTAPI SETUP ==========
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========== MODEL LOAD ==========
print("Loading TinyLlama-1.1B-Chat...")
model_name = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
tokenizer = AutoTokenizer.from_pretrained(model_name)

if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

# Auto-detect device (GPU if available, else CPU)
device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"🎯 Using device: {device.upper()}")

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float16 if device == 'cuda' else torch.float32
)

model = model.to(device)
model.eval()

pipe = pipeline(
    "text-generation", 
    model=model, 
    tokenizer=tokenizer, 
    device=0 if device == 'cuda' else -1
)
print(f"✓ Model loaded successfully on {device.upper()}")


# ========== NEW PREPROCESSING HELPERS ==========
def remove_document_noise(text: str) -> str:
    """Remove headers, footers, page numbers, and repetitive content"""
    lines = text.split('\n')
    cleaned_lines = []
    
    # Track line frequency to detect headers/footers (they repeat on every page)
    line_freq = Counter(lines)
    
    for line in lines:
        line_stripped = line.strip()
        
        # Skip empty lines
        if not line_stripped:
            continue
        
        # Skip page numbers (standalone numbers or "Page X" patterns)
        if re.match(r'^(?:page\s*)?\d+(?:\s*of\s*\d+)?$', line_stripped, re.IGNORECASE):
            continue
        
        # Skip very short lines (likely headers/footers)
        if len(line_stripped) < 10:
            continue
        
        # Skip lines that appear more than 3 times (likely headers/footers)
        if line_freq[line] > 3:
            continue
        
        # Skip common PDF artifacts
        if any(artifact in line_stripped.lower() for artifact in ['copyright', '©', 'all rights reserved', 'confidential']):
            continue
        
        cleaned_lines.append(line_stripped)
    
    return ' '.join(cleaned_lines)


def score_sentence(sentence: str, term_freq: dict) -> float:
    """Score sentence based on information density"""
    words = sentence.split()
    
    if len(words) < 5:  # Too short
        return 0.0
    
    # Count capitalized terms (likely important concepts)
    cap_count = sum(1 for w in words if w and w[0].isupper() and len(w) > 2)
    
    # Count term occurrences
    term_count = sum(term_freq.get(w.lower(), 0) for w in words)
    
    # Calculate density: important words / total words
    density = (cap_count + term_count) / len(words)
    
    # Penalize very long sentences (harder to parse)
    length_penalty = 1.0 if len(words) <= 25 else 0.7
    
    # Bonus for sentences with definitions ("is", "are", "has")
    definition_bonus = 1.2 if any(pattern in sentence.lower() for pattern in [' is ', ' are ', ' has ', ' have ']) else 1.0
    
    return density * length_penalty * definition_bonus


def rank_sentences(text: str, top_n: int = 15) -> str:
    """Select most information-dense sentences"""
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if len(s.strip()) > 20]
    
    if len(sentences) <= top_n:
        return text
    
    # Build term frequency map
    all_words = ' '.join(sentences).lower().split()
    term_freq = Counter(all_words)
    
    # Score each sentence
    scored = [(sent, score_sentence(sent, term_freq)) for sent in sentences]
    
    # Sort by score, keep top N
    sorted_sents = sorted(scored, key=lambda x: x[1], reverse=True)
    top_sentences = [s[0] for s in sorted_sents[:top_n]]
    
    return '. '.join(top_sentences) + '.'


def selective_stopword_removal(text: str) -> str:
    """Remove common stopwords while keeping important ones"""
    # Light stopword list (aggressive removal can hurt comprehension)
    stopwords = {'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
                 'of', 'as', 'by', 'with', 'up', 'about', 'into', 'through', 'during'}
    
    words = text.split()
    filtered = []
    
    for i, word in enumerate(words):
        word_lower = word.lower()
        
        # Keep stopword if it's at the start of a sentence or near capitalized terms
        if word_lower in stopwords:
            if i == 0 or (i > 0 and words[i-1].endswith('.')):
                filtered.append(word)
            elif i < len(words) - 1 and words[i+1] and words[i+1][0].isupper():
                filtered.append(word)
            # Otherwise skip it
        else:
            filtered.append(word)
    
    return ' '.join(filtered)


def preprocess_text(text: str) -> str:
    """Main preprocessing pipeline"""
    print("🧹 Preprocessing text...")
    
    # Step 1: Remove document noise
    text = remove_document_noise(text)
    print(f"   After noise removal: {len(text)} chars")
    
    # Step 2: Rank and select information-dense sentences
    text = rank_sentences(text, top_n=20)
    print(f"   After sentence ranking: {len(text)} chars")
    
    # Step 3: Light stopword removal
    text = selective_stopword_removal(text)
    print(f"   After stopword removal: {len(text)} chars")
    
    # Step 4: Apply character limit as safety
    return text[:1500]


# ========== ORIGINAL HELPERS (UPDATED) ==========
def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract and preprocess text from PDF"""
    text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        print(f"Error: {e}")
        return ""
    
    # Apply preprocessing pipeline
    return preprocess_text(text.strip())


def extract_facts(text: str):
    """Extract key facts and terms from text"""
    sentences = [s.strip() for s in text.split('.') if len(s.strip()) > 20]
    
    facts = {}  # term -> description
    terms = []  # all important terms
    
    for sentence in sentences:
        # Skip title lines
        if sentence.isupper() or len(sentence.split()) < 5:
            continue
        
        # "X is Y" pattern
        is_match = re.search(r'([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)\s+is\s+(?:the\s+)?(.+)', sentence)
        if is_match:
            term = is_match.group(1).strip()
            description = is_match.group(2).strip()
            desc_words = description.split()[:6]
            description_short = ' '.join(desc_words).rstrip('.,;:')
            
            if term not in ["The", "This", "That", "Review", "Guide", "Overview"]:
                facts[term] = description_short
                if term not in terms:
                    terms.append(term)
        
        # "X has/provides/contains Y" pattern
        action_match = re.search(r'([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)\s+(?:has|have|provides?|contains?|includes?)\s+(.+)', sentence)
        if action_match:
            term = action_match.group(1).strip()
            description = action_match.group(2).strip()
            desc_words = description.split()[:6]
            description_short = ' '.join(desc_words).rstrip('.,;:')
            
            if term not in ["The", "This", "Review", "Guide"]:
                facts[term] = description_short
                if term not in terms:
                    terms.append(term)
        
        # Extract any capitalized terms
        words = sentence.split()
        for word in words:
            clean = word.strip('.,;:()[]{}\'\"')
            if clean and len(clean) > 2 and clean[0].isupper() and clean not in terms:
                if clean not in ["The", "This", "That", "Review", "Guide", "Overview", "Computer", "Parts"]:
                    terms.append(clean)
    
    return {'facts': facts, 'terms': terms[:20]}


def generate_mcqs_with_tinyllama(text: str, num_questions: int = 5):
    """Generate MCQs with improved prompting"""
    
    prompt = f"""<|system|>
You are a quiz creator. Generate questions in this exact format:

Question 1: [question text]?
A) [choice]
B) [choice]
C) [choice]
Correct: A

</s>
<|user|>
Create {num_questions} multiple choice questions from this text. Each question must have exactly 3 answer choices (A, B, C) and indicate the correct answer.

Text:
{text}

Create {num_questions} questions now:</s>
<|assistant|>
"""
    
    try:
        print("🔄 Generating questions...")
        
        with torch.no_grad():
            response = pipe(
                prompt,
                max_new_tokens=800,
                temperature=0.6,
                do_sample=True,
                top_p=0.9,
                repetition_penalty=1.3,
                pad_token_id=tokenizer.eos_token_id,
                eos_token_id=tokenizer.eos_token_id
            )
        
        generated = response[0]['generated_text'].split("<|assistant|>")[-1].strip()
        print(f"📝 Generated text preview:\n{generated[:300]}...\n")
        
        mcqs = parse_mcqs(generated, num_questions)
        
        # Fallback if parsing fails or not enough questions
        if len(mcqs) < num_questions // 2:
            print("⚠️ Using fallback...")
            facts_data = extract_facts(text)
            mcqs = create_fallback_mcqs(facts_data, num_questions)
        
        return mcqs
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        facts_data = extract_facts(text)
        return create_fallback_mcqs(facts_data, num_questions)


def create_fallback_mcqs(facts_data: dict, num_questions: int = 5):
    """Create MCQs with TERMS as choices, not definitions"""
    facts = facts_data['facts']
    terms = facts_data['terms']
    
    print(f"🔄 Creating fallback questions...")
    print(f"   Found {len(facts)} facts and {len(terms)} terms")
    
    mcqs = []
    used = set()
    
    # Strategy 1: Create "Which is X?" questions with terms as choices
    for term, description in facts.items():
        if len(mcqs) >= num_questions:
            break
        
        if term in used:
            continue
        
        used.add(term)
        
        # Get other terms as wrong answers
        other_terms = [t for t in terms if t != term and t not in used]
        
        if len(other_terms) < 2:
            other_terms.extend(["Unknown", "None", "Other"])
        
        choices = [term, other_terms[0], other_terms[1] if len(other_terms) > 1 else "Other"]
        random.shuffle(choices)
        
        # Take key words from description
        desc_words = description.split()
        if len(desc_words) > 5:
            desc_short = ' '.join(desc_words[:5])
        else:
            desc_short = description
        
        mcqs.append({
            'question': f"Which is {desc_short}?",
            'choices': choices,
            'correctIndex': choices.index(term)
        })
    
    # Strategy 2: "What is mentioned about X?" questions
    while len(mcqs) < num_questions and len(terms) >= 3:
        available = [t for t in terms if t not in used]
        
        if len(available) < 3:
            break
        
        correct = available[0]
        wrong1 = available[1]
        wrong2 = available[2]
        
        used.update([correct, wrong1, wrong2])
        
        choices = [correct, wrong1, wrong2]
        random.shuffle(choices)
        
        mcqs.append({
            'question': f"What is discussed in the text?",
            'choices': choices,
            'correctIndex': choices.index(correct)
        })
    
    print(f"✅ Created {len(mcqs)} fallback questions")
    return mcqs[:num_questions]


def parse_mcqs(text: str, target: int = 5):
    """Parse MCQs with multiple pattern support"""
    mcqs = []
    
    # Pattern 1: "Question N:" format
    pattern1 = r'Question\s+\d+:\s*(.+?)(?=Question\s+\d+:|$)'
    blocks = re.findall(pattern1, text, re.DOTALL | re.IGNORECASE)
    
    # Pattern 2: "N." or "Q N:" format (fallback)
    if not blocks:
        pattern2 = r'(?:^|\n)(?:\d+\.|Q\d+:)\s*(.+?)(?=(?:^|\n)(?:\d+\.|Q\d+:)|$)'
        blocks = re.findall(pattern2, text, re.DOTALL | re.IGNORECASE)
    
    for block in blocks:
        lines = [line.strip() for line in block.split('\n') if line.strip()]
        
        if len(lines) < 4:
            continue
        
        # Extract question
        question = lines[0].strip('?:').strip()
        if not question.endswith('?'):
            question += "?"
        
        # Extract choices
        choices = []
        correct_idx = 0
        
        for line in lines[1:]:
            choice_match = re.match(r'^([ABC])[\).\:]\s*(.+)', line, re.IGNORECASE)
            if choice_match:
                answer_text = choice_match.group(2).strip()
                choices.append(answer_text)
            
            correct_match = re.match(r'(?:Correct|Answer):?\s*([ABC])', line, re.IGNORECASE)
            if correct_match:
                correct_idx = ord(correct_match.group(1).upper()) - ord('A')
        
        if len(choices) >= 3 and question:
            mcqs.append({
                'question': question,
                'choices': choices[:3],
                'correctIndex': min(correct_idx, 2)
            })
        
        if len(mcqs) >= target:
            break
    
    if mcqs:
        print(f"✅ Parsed {len(mcqs)} questions from model output")
    
    return mcqs


# ========== VALIDATION HELPER ==========
def validate_mcq(mcq: dict) -> bool:
    """Validate MCQ structure"""
    return (
        'question' in mcq and 
        'choices' in mcq and 
        'correctIndex' in mcq and
        len(mcq['choices']) == 3 and
        0 <= mcq['correctIndex'] < 3 and
        len(mcq['question']) > 10 and
        all(len(choice) > 0 for choice in mcq['choices'])
    )


# ========== ROUTES ==========
@app.get("/")
async def root():
    device_name = next(model.parameters()).device.type if model else "unknown"
    return {
        "message": "TinyLlama MCQ Generator - Enhanced",
        "model": "TinyLlama-1.1B-Chat-v1.0",
        "device": device_name.upper(),
        "features": ["preprocessing", "noise_removal", "sentence_ranking", "gpu_support"],
        "status": "ready"
    }


@app.post("/generate")
async def generate(file: UploadFile = File(...)):
    """Generate 5 MCQs from PDF"""
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files supported")
    
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            if not content:
                raise HTTPException(status_code=400, detail="Empty file")
            tmp.write(content)
            tmp_path = tmp.name
        
        print(f"\n{'='*60}")
        print(f"⚡ Processing: {file.filename}")
        
        text = extract_text_from_pdf(tmp_path)
        if len(text) < 50:
            raise HTTPException(status_code=400, detail="Text too short after preprocessing")
        
        print(f"📊 Final text length: {len(text)} characters")
        
        questions = generate_mcqs_with_tinyllama(text, 5)
        
        # Validate all questions
        questions = [q for q in questions if validate_mcq(q)]
        
        if not questions:
            raise HTTPException(status_code=500, detail="Generation failed")
        
        print(f"✅ Returning {len(questions)} validated questions")
        for i, q in enumerate(questions, 1):
            print(f"   Q{i}: {q['question'][:50]}...")
        print(f"{'='*60}\n")
        
        return {
            "success": True,
            "questions": questions,
            "count": len(questions),
            "model": "TinyLlama",
            "preprocessed": True
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")
    
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except:
                pass


@app.get("/health")
async def health():
    device_name = next(model.parameters()).device.type if model else "unknown"
    return {
        "status": "healthy", 
        "model_loaded": model is not None,
        "model": "TinyLlama-1.1B",
        "device": device_name.upper(),
        "preprocessing": "enabled"
    }


@app.get("/favicon.ico")
async def favicon():
    return {}


if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*60)
    print("⚡ TinyLlama MCQ Generator - ENHANCED")
    print("🧹 With preprocessing: noise removal + sentence ranking")
    print("📝 Improved prompt formatting and validation")
    print(f"🎯 Running on: {device.upper()}")
    print("📍 API: http://localhost:8000")
    print("="*60 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)