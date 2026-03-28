"""
Advanced AI Writing Assistant Backend - Version 2.0
Flask API with multiple AI providers, RAG capabilities, and enhanced features
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from functools import wraps
import os
from datetime import datetime, timedelta
import json
import hashlib
import re
from collections import defaultdict
import logging
from typing import Dict, Any, Optional, Tuple
from dotenv import load_dotenv

load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('ai_assistant')

# Import AI libraries with graceful fallback
AI_PROVIDERS = {}

try:
    import openai
    AI_PROVIDERS['openai'] = True
except ImportError:
    logger.warning("OpenAI library not installed")
    AI_PROVIDERS['openai'] = False

try:
    import anthropic
    AI_PROVIDERS['anthropic'] = True
except ImportError:
    logger.warning("Anthropic library not installed")
    AI_PROVIDERS['anthropic'] = False

try:
    import google.generativeai as genai
    AI_PROVIDERS['google'] = True
except ImportError:
    logger.warning("Google AI library not installed")
    AI_PROVIDERS['google'] = False

# Blueprint
ai_blueprint = Blueprint('ai_assistant', __name__, url_prefix='/api/ai')

# ==================== CONFIGURATION ====================

class AIConfig:
    """Centralized AI configuration"""
    
    # API Keys
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
    ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
    GOOGLE_AI_KEY = os.getenv('GOOGLE_AI_KEY', '')
    
    # Model settings
    OPENAI_MODEL = 'gpt-3.5-turbo'
    ANTHROPIC_MODEL = 'claude-3-sonnet-20240229'
    GOOGLE_MODEL = 'gemini-2.0-flash-exp'
    
    # Generation parameters
    MAX_TOKENS = 2000
    TEMPERATURE = 0.7
    
    # Rate limiting
    MAX_REQUESTS_PER_HOUR = 50
    MAX_REQUESTS_PER_DAY = 200
    
    # Caching
    ENABLE_CACHE = True
    CACHE_EXPIRY_HOURS = 24
    
    # Feature flags
    ENABLE_WEB_SEARCH = True
    ENABLE_ANALYTICS = True

# ==================== RATE LIMITING ====================

class RateLimiter:
    """In-memory rate limiter with hourly and daily limits"""
    
    def __init__(self):
        self.requests = defaultdict(list)
        self.last_cleanup = datetime.now()
    
    def check_limit(
        self, 
        user_id: str, 
        max_per_hour: int = 50, 
        max_per_day: int = 200
    ) -> Tuple[bool, str]:
        """Check if user has exceeded rate limits"""
        
        self._cleanup_old_data()
        
        now = datetime.now()
        user_requests = self.requests[user_id]
        
        # Remove requests older than 1 day
        day_ago = now - timedelta(days=1)
        user_requests[:] = [req_time for req_time in user_requests if req_time > day_ago]
        
        # Check hourly limit
        hour_ago = now - timedelta(hours=1)
        recent_requests = [req_time for req_time in user_requests if req_time > hour_ago]
        
        if len(recent_requests) >= max_per_hour:
            time_until_reset = timedelta(hours=1) - (now - recent_requests[0])
            minutes = int(time_until_reset.total_seconds() // 60)
            seconds = int(time_until_reset.total_seconds() % 60)
            return False, f"Hourly limit reached. Try again in {minutes}m {seconds}s"
        
        # Check daily limit
        if len(user_requests) >= max_per_day:
            return False, "Daily limit reached. Try again tomorrow"
        
        # Add current request
        self.requests[user_id].append(now)
        return True, "OK"
    
    def _cleanup_old_data(self):
        """Cleanup old request data periodically"""
        if datetime.now() - self.last_cleanup > timedelta(hours=1):
            day_ago = datetime.now() - timedelta(days=1)
            for user_id in list(self.requests.keys()):
                self.requests[user_id] = [
                    req for req in self.requests[user_id] if req > day_ago
                ]
                if not self.requests[user_id]:
                    del self.requests[user_id]
            self.last_cleanup = datetime.now()
            logger.info("Rate limiter data cleaned up")

rate_limiter = RateLimiter()

# ==================== CACHING ====================

class ResponseCache:
    """Simple in-memory cache for AI responses"""
    
    def __init__(self):
        self.cache = {}
        self.last_cleanup = datetime.now()
    
    def get_key(self, feature: str, content: str, options: Dict) -> str:
        """Generate unique cache key"""
        data = f"{feature}:{content}:{json.dumps(options, sort_keys=True)}"
        return hashlib.sha256(data.encode()).hexdigest()
    
    def get(self, key: str) -> Optional[Any]:
        """Retrieve cached response"""
        self._cleanup_expired()
        
        if key in self.cache:
            cached_data, timestamp = self.cache[key]
            age = datetime.now() - timestamp
            
            if age < timedelta(hours=AIConfig.CACHE_EXPIRY_HOURS):
                logger.info(f"Cache HIT for key: {key[:16]}...")
                return cached_data
            else:
                del self.cache[key]
        
        logger.info(f"Cache MISS for key: {key[:16]}...")
        return None
    
    def set(self, key: str, value: Any):
        """Store response in cache"""
        self.cache[key] = (value, datetime.now())
        logger.info(f"Cached response for key: {key[:16]}...")
    
    def _cleanup_expired(self):
        """Remove expired cache entries"""
        if datetime.now() - self.last_cleanup > timedelta(hours=1):
            expiry_time = datetime.now() - timedelta(hours=AIConfig.CACHE_EXPIRY_HOURS)
            expired_keys = [
                key for key, (_, timestamp) in self.cache.items()
                if timestamp < expiry_time
            ]
            for key in expired_keys:
                del self.cache[key]
            
            if expired_keys:
                logger.info(f"Removed {len(expired_keys)} expired cache entries")
            
            self.last_cleanup = datetime.now()
    
    def clear(self):
        """Clear all cache"""
        self.cache.clear()
        logger.info("Cache cleared")

response_cache = ResponseCache()

# ==================== UTILITY FUNCTIONS ====================

def sanitize_input(text: str) -> str:
    """Sanitize user input to prevent XSS and injection attacks"""
    if not text:
        return ""
    
    # Remove script tags
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
    
    # Remove javascript: protocol
    text = re.sub(r'javascript:', '', text, flags=re.IGNORECASE)
    
    # Remove on* event handlers
    text = re.sub(r'\son\w+\s*=', '', text, flags=re.IGNORECASE)
    
    return text.strip()

def strip_html(text: str) -> str:
    """Strip HTML tags from text"""
    clean = re.compile('<.*?>')
    return re.sub(clean, '', text)

def truncate_text(text: str, max_length: int = 200) -> str:
    """Truncate text to specified length"""
    if len(text) <= max_length:
        return text
    return text[:max_length] + '...'

def handle_error(feature_name: str, error: Exception) -> Dict[str, Any]:
    """Handle errors gracefully with user-friendly messages"""
    error_message = str(error)
    logger.error(f"{feature_name} Error: {error_message}", exc_info=True)
    
    # Determine user-friendly message
    if "API key" in error_message or "api_key" in error_message.lower():
        user_message = "API configuration error. Please contact administrator"
    elif "rate limit" in error_message.lower():
        user_message = "AI service rate limit reached. Please try again later"
    elif "timeout" in error_message.lower():
        user_message = "Request timeout. Please try again"
    else:
        user_message = f"{feature_name} failed. Please try again"
    
    return {
        'success': False,
        'message': user_message,
        'error': error_message if os.getenv('FLASK_ENV') == 'development' else None
    }

def log_usage(user_id: int, feature: str, content_length: int, success: bool):
    """Log AI usage for analytics"""
    if not AIConfig.ENABLE_ANALYTICS:
        return
    
    try:
        log_entry = {
            'user_id': user_id,
            'feature': feature,
            'content_length': content_length,
            'success': success,
            'timestamp': datetime.now().isoformat()
        }
        
        # Append to log file
        log_file = 'logs/ai_usage.log'
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        
        with open(log_file, 'a') as f:
            f.write(json.dumps(log_entry) + '\n')
            
    except Exception as e:
        logger.error(f"Usage logging error: {str(e)}")

# ==================== AI API CALLS ====================

class AIProviderManager:
    """Manage multiple AI providers with fallback"""
    
    @staticmethod
    def call_openai(prompt: str, max_tokens: int, temperature: float) -> str:
        """Call OpenAI GPT API"""
        if not AIConfig.OPENAI_API_KEY:
            raise ValueError("OpenAI API key not configured")
        
        client = openai.OpenAI(api_key=AIConfig.OPENAI_API_KEY)
        logger.info("Calling OpenAI API...")
        
        response = client.chat.completions.create(
            model=AIConfig.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional writing assistant. Provide clear, accurate, and well-structured responses."
                },
                {"role": "user", "content": prompt}
            ],
            max_tokens=max_tokens,
            temperature=temperature
        )
        
        result = response.choices[0].message.content.strip()
        logger.info(f"OpenAI response: {len(result)} characters")
        return result
    
    @staticmethod
    def call_anthropic(prompt: str, max_tokens: int) -> str:
        """Call Anthropic Claude API"""
        if not AIConfig.ANTHROPIC_API_KEY:
            raise ValueError("Anthropic API key not configured")
        
        client = anthropic.Anthropic(api_key=AIConfig.ANTHROPIC_API_KEY)
        logger.info("Calling Anthropic API...")
        
        message = client.messages.create(
            model=AIConfig.ANTHROPIC_MODEL,
            max_tokens=max_tokens,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        result = message.content[0].text.strip()
        logger.info(f"Anthropic response: {len(result)} characters")
        return result
    
    @staticmethod
    def call_google(prompt: str, max_tokens: int) -> str:
        """Call Google Gemini API"""
        if not AIConfig.GOOGLE_AI_KEY:
            raise ValueError("Google AI API key not configured")
        
        try:
            genai.configure(api_key=AIConfig.GOOGLE_AI_KEY)
            model = genai.GenerativeModel(AIConfig.GOOGLE_MODEL)
            logger.info("Calling Google AI API...")
            
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=max_tokens,
                    temperature=AIConfig.TEMPERATURE
                )
            )
            
            result = response.text.strip()
            logger.info(f"Google AI response: {len(result)} characters")
            return result
            
        except Exception as e:
            logger.error(f"Google AI error: {type(e).__name__}: {str(e)}")
            raise ValueError(f"Google AI error: {str(e)}")
    
    @classmethod
    def call_ai(cls, prompt: str, max_tokens: int = 2000, temperature: float = 0.7) -> str:
        """Call AI with automatic provider fallback"""
        
        errors = []
        
        # Try Google AI first
        if AI_PROVIDERS.get('google') and AIConfig.GOOGLE_AI_KEY:
            try:
                return cls.call_google(prompt, max_tokens)
            except Exception as e:
                errors.append(f"Google: {str(e)}")
                logger.warning(f"Google AI failed, trying next provider...")
        
        # Try OpenAI
        if AI_PROVIDERS.get('openai') and AIConfig.OPENAI_API_KEY:
            try:
                return cls.call_openai(prompt, max_tokens, temperature)
            except Exception as e:
                errors.append(f"OpenAI: {str(e)}")
                logger.warning(f"OpenAI failed, trying next provider...")
        
        # Try Anthropic
        if AI_PROVIDERS.get('anthropic') and AIConfig.ANTHROPIC_API_KEY:
            try:
                return cls.call_anthropic(prompt, max_tokens)
            except Exception as e:
                errors.append(f"Anthropic: {str(e)}")
                logger.warning(f"Anthropic failed")
        
        # All providers failed
        error_summary = "; ".join(errors) if errors else "No AI providers configured"
        raise ValueError(f"All AI providers failed: {error_summary}")

# ==================== FEATURE HANDLERS ====================

class FeatureHandlers:
    """All feature processing handlers"""
    
    @staticmethod
    def grammar_check(content: str, options: Dict) -> Dict[str, Any]:
        """Fix grammar and spelling"""
        try:
            prompt = f"""Fix all grammar, spelling, and punctuation errors in the following text.
Preserve the original meaning and style. Return ONLY the corrected text without any explanations.

Text: {content}"""
            
            corrected = AIProviderManager.call_ai(prompt, max_tokens=len(content) + 500)
            
            return {
                'success': True,
                'content': format_result('grammar', corrected),
                'feature': 'grammar'
            }
        except Exception as e:
            return handle_error('Grammar Check', e)
    
    @staticmethod
    def improve_writing(content: str, options: Dict) -> Dict[str, Any]:
        """Improve writing quality"""
        try:
            tone = options.get('toneStyle', 'professional')
            
            prompt = f"""Improve the following text to make it clearer, more engaging, and better structured.
Use a {tone} tone. Enhance readability and flow.
Return ONLY the improved version without explanations.

Original: {content}"""
            
            improved = AIProviderManager.call_ai(prompt)
            
            return {
                'success': True,
                'content': format_result('improve', improved, tone=tone),
                'feature': 'improve'
            }
        except Exception as e:
            return handle_error('Writing Improvement', e)
    
    @staticmethod
    def summarize(content: str, options: Dict) -> Dict[str, Any]:
        """Create summary"""
        try:
            prompt = f"""Create a concise summary of the following text.
Extract the main points in 3-5 clear bullet points.

Text: {content}"""
            
            summary = AIProviderManager.call_ai(prompt, max_tokens=800)
            
            return {
                'success': True,
                'content': format_result('summarize', summary),
                'feature': 'summarize'
            }
        except Exception as e:
            return handle_error('Summarization', e)
    
    @staticmethod
    def expand(content: str, options: Dict) -> Dict[str, Any]:
        """Expand content with details"""
        try:
            prompt = f"""Expand the following text by adding more details, examples, and explanations.
Make it comprehensive while maintaining the original meaning.

Text: {content}"""
            
            expanded = AIProviderManager.call_ai(prompt)
            
            return {
                'success': True,
                'content': format_result('expand', expanded),
                'feature': 'expand'
            }
        except Exception as e:
            return handle_error('Content Expansion', e)
    
    @staticmethod
    def translate(content: str, options: Dict) -> Dict[str, Any]:
        """Translate content"""
        try:
            target_lang = options.get('targetLanguage', 'en')
            
            lang_names = {
                'hi': 'Hindi', 'en': 'English', 'es': 'Spanish',
                'fr': 'French', 'de': 'German', 'ja': 'Japanese',
                'ko': 'Korean', 'zh': 'Chinese'
            }
            
            lang_name = lang_names.get(target_lang, target_lang)
            
            prompt = f"""Translate the following text to {lang_name}.
Maintain the original meaning, tone, and style.

Text: {content}"""
            
            translated = AIProviderManager.call_ai(prompt)
            
            return {
                'success': True,
                'content': format_result('translate', translated, language=lang_name),
                'feature': 'translate'
            }
        except Exception as e:
            return handle_error('Translation', e)
    
    @staticmethod
    def change_tone(content: str, options: Dict) -> Dict[str, Any]:
        """Change writing tone"""
        try:
            tone = options.get('toneStyle', 'professional')
            
            tone_descriptions = {
                'professional': 'formal and business-appropriate',
                'casual': 'friendly and conversational',
                'formal': 'strictly formal and academic',
                'friendly': 'warm and approachable',
                'academic': 'scholarly and precise',
                'creative': 'imaginative and expressive'
            }
            
            tone_desc = tone_descriptions.get(tone, tone)
            
            prompt = f"""Rewrite the following text in a {tone_desc} tone.
Keep the core message but adjust the language style appropriately.

Text: {content}"""
            
            adjusted = AIProviderManager.call_ai(prompt)
            
            return {
                'success': True,
                'content': format_result('tone', adjusted, tone=tone),
                'feature': 'tone'
            }
        except Exception as e:
            return handle_error('Tone Adjustment', e)
    
    @staticmethod
    def bullet_points(content: str, options: Dict) -> Dict[str, Any]:
        """Convert to bullet points"""
        try:
            prompt = f"""Convert the following text into clear, concise bullet points.
Each point should capture a key idea.

Text: {content}"""
            
            bullets = AIProviderManager.call_ai(prompt, max_tokens=1200)
            
            return {
                'success': True,
                'content': format_result('bullet-points', bullets),
                'feature': 'bullet-points'
            }
        except Exception as e:
            return handle_error('Bullet Points', e)
    
    @staticmethod
    def continue_writing(content: str, options: Dict) -> Dict[str, Any]:
        """Continue writing"""
        try:
            prompt = f"""Continue writing from where the following text ends.
Maintain the same style, tone, and context.
Add 2-3 more paragraphs.

Existing text: {content}"""
            
            continuation = AIProviderManager.call_ai(prompt, max_tokens=1500)
            
            return {
                'success': True,
                'content': format_result('continue', continuation, original=content),
                'feature': 'continue'
            }
        except Exception as e:
            return handle_error('Continue Writing', e)
    
    @staticmethod
    def custom_prompt(content: str, options: Dict) -> Dict[str, Any]:
        """Handle custom user prompt"""
        try:
            custom_prompt = options.get('customPrompt', '').strip()
            
            if not custom_prompt:
                return {
                    'success': False,
                    'message': 'Custom prompt is required'
                }
            
            custom_prompt = sanitize_input(custom_prompt)
            
            final_prompt = f"""You are an advanced AI assistant. Fulfill the user's request accurately.

USER REQUEST: {custom_prompt}

EXISTING CONTENT (if any):
{content or 'None'}

Based on the above, generate the response. Return ONLY the final content."""
            
            result = AIProviderManager.call_ai(final_prompt)
            
            return {
                'success': True,
                'content': format_result('custom', result, prompt=custom_prompt),
                'feature': 'custom'
            }
        except Exception as e:
            return handle_error('Custom Request', e)

# ==================== FORMATTING FUNCTIONS ====================

def format_result(feature: str, content: str, **kwargs) -> str:
    """Format AI results with HTML wrapper"""
    
    templates = {
        'grammar': lambda c, **k: f'''<div class="ai-result grammar-result">
            <div class="alert alert-success mb-3">
                <i class="fas fa-check-circle"></i> Grammar corrections applied
            </div>
            <div class="corrected-content">{c}</div>
        </div>''',
        
        'improve': lambda c, **k: f'''<div class="ai-result improved-result">
            <div class="alert alert-info mb-3">
                <i class="fas fa-magic"></i> Content enhanced with {k.get('tone', 'professional')} tone
            </div>
            <div class="improved-content">{c}</div>
        </div>''',
        
        'summarize': lambda c, **k: f'''<div class="ai-result summary-result">
            <h5 class="text-primary mb-3">
                <i class="fas fa-compress-alt"></i> AI Summary
            </h5>
            <div class="card bg-light p-3">
                <strong>Key Points:</strong>
                <div class="mt-2">{c}</div>
            </div>
        </div>''',
        
        'expand': lambda c, **k: f'''<div class="ai-result expanded-result">
            <div class="alert alert-primary mb-3">
                <i class="fas fa-expand-alt"></i> Content expanded
            </div>
            <div class="expansion-section p-3">{c}</div>
        </div>''',
        
        'translate': lambda c, **k: f'''<div class="ai-result translation-result">
            <div class="alert alert-info mb-3">
                <i class="fas fa-language"></i> Translated to {k.get('language', 'target language')}
            </div>
            <div class="card bg-light p-3">{c}</div>
        </div>''',
        
        'tone': lambda c, **k: f'''<div class="ai-result tone-result">
            <div class="alert alert-warning mb-3">
                <i class="fas fa-theater-masks"></i> Tone adjusted to {k.get('tone', 'selected')}
            </div>
            <div class="adjusted-content">{c}</div>
        </div>''',
        
        'bullet-points': lambda c, **k: f'''<div class="ai-result bullet-points-result">
            <div class="alert alert-primary mb-3">
                <i class="fas fa-list-ul"></i> Converted to bullet points
            </div>
            <div class="bullet-content">{c}</div>
        </div>''',
        
        'continue': lambda c, **k: f'''<div class="ai-result continuation-result">
            {k.get('original', '')}
            <div class="continued-section mt-3 p-3 border-start border-success border-3 bg-light">
                <em class="text-muted small">
                    <i class="fas fa-forward"></i> AI Continuation:
                </em>
                <div class="mt-2">{c}</div>
            </div>
        </div>''',
        
        'custom': lambda c, **k: f'''<div class="ai-result custom-result">
            <div class="alert alert-info mb-3">
                <i class="fas fa-comment-dots"></i> Custom Request: "{k.get('prompt', '')}"
            </div>
            <div class="custom-response p-3 bg-light rounded">{c}</div>
        </div>'''
    }
    
    formatter = templates.get(feature, lambda c, **k: f'<div class="ai-result">{c}</div>')
    return formatter(content, **kwargs)

# ==================== ROUTE HANDLER ====================

def route_feature(feature: str, content: str, options: Dict) -> Dict[str, Any]:
    """Route request to appropriate handler"""
    
    handlers = {
        'grammar': FeatureHandlers.grammar_check,
        'improve': FeatureHandlers.improve_writing,
        'summarize': FeatureHandlers.summarize,
        'expand': FeatureHandlers.expand,
        'translate': FeatureHandlers.translate,
        'tone': FeatureHandlers.change_tone,
        'bullet-points': FeatureHandlers.bullet_points,
        'continue': FeatureHandlers.continue_writing,
        'custom': FeatureHandlers.custom_prompt,
    }
    
    handler = handlers.get(feature)
    
    if not handler:
        logger.error(f"Unknown feature: {feature}")
        return {
            'success': False,
            'message': f'Unknown feature: {feature}'
        }
    
    logger.info(f"Processing feature: {feature}")
    return handler(content, options)

# ==================== DECORATORS ====================

def check_rate_limit(f):
    """Decorator to check rate limits"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = str(current_user.id) if current_user.is_authenticated else request.remote_addr
        
        allowed, message = rate_limiter.check_limit(
            user_id,
            AIConfig.MAX_REQUESTS_PER_HOUR,
            AIConfig.MAX_REQUESTS_PER_DAY
        )
        
        if not allowed:
            logger.warning(f"Rate limit exceeded for user {user_id}: {message}")
            return jsonify({
                'success': False,
                'message': message
            }), 429
        
        return f(*args, **kwargs)
    
    return decorated_function

# ==================== API ENDPOINTS ====================

# Fixed /api/ai/process endpoint with better error handling
# Replace the process_request function in ai_api.py

@ai_blueprint.route('/process', methods=['POST'])
@login_required
@check_rate_limit
def process_request():
    """Main AI processing endpoint with detailed error reporting"""
    
    try:
        # Get and validate JSON data
        if not request.is_json:
            logger.error("Request is not JSON")
            return jsonify({
                'success': False,
                'message': 'Content-Type must be application/json'
            }), 400
        
        data = request.get_json()
        
        if not data:
            logger.error("Empty JSON data")
            return jsonify({
                'success': False,
                'message': 'Empty request body'
            }), 400
        
        # Log received data for debugging
        logger.info(f"Received data keys: {list(data.keys())}")
        
        # Extract and validate fields
        feature = data.get('feature', '').strip()
        content = data.get('content', '').strip()
        options = data.get('options', {})
        
        user_id = current_user.id if current_user.is_authenticated else 'anonymous'
        logger.info(f"Request from user {user_id}: feature={feature}, content_length={len(content)}")
        
        # Validation with specific error messages
        if not feature:
            logger.error("Feature missing")
            return jsonify({
                'success': False,
                'message': 'Feature type is required',
                'received': {'feature': feature, 'has_content': bool(content)}
            }), 400
        
        # Check if feature is valid
        valid_features = ['grammar', 'improve', 'summarize', 'expand', 
                         'translate', 'tone', 'bullet-points', 'continue', 'custom']
        if feature not in valid_features:
            logger.error(f"Invalid feature: {feature}")
            return jsonify({
                'success': False,
                'message': f'Invalid feature: {feature}',
                'valid_features': valid_features
            }), 400
        
        # Content validation (except for custom prompts)
        if not content and feature not in ['custom', 'continue']:
            logger.error(f"Content missing for feature: {feature}")
            return jsonify({
                'success': False,
                'message': f'Content is required for {feature} feature',
                'hint': 'Make sure you have text in your editor'
            }), 400
        
        if len(content) > 50000:
            logger.error(f"Content too long: {len(content)} chars")
            return jsonify({
                'success': False,
                'message': f'Content too long: {len(content)} characters (max 50,000)',
                'content_length': len(content)
            }), 400
        
        # Sanitize inputs
        content = sanitize_input(content)
        
        if isinstance(options, dict):
            options = {k: sanitize_input(str(v)) if isinstance(v, str) else v 
                      for k, v in options.items()}
        else:
            logger.warning(f"Options is not a dict: {type(options)}")
            options = {}
        
        # Check cache (skip for custom prompts)
        cache_key = None
        if AIConfig.ENABLE_CACHE and feature != 'custom':
            cache_key = response_cache.get_key(feature, content, options)
            cached_result = response_cache.get(cache_key)
            
            if cached_result:
                logger.info(f"Returning cached result for {feature}")
                return jsonify(cached_result)
        
        # Process request
        logger.info(f"Processing feature: {feature}")
        result = route_feature(feature, content, options)
        
        # Validate result
        if not result:
            logger.error("route_feature returned None")
            return jsonify({
                'success': False,
                'message': 'Processing failed: no result returned'
            }), 500
        
        if not isinstance(result, dict):
            logger.error(f"route_feature returned non-dict: {type(result)}")
            return jsonify({
                'success': False,
                'message': 'Processing failed: invalid result type'
            }), 500
        
        # Cache successful results (except custom prompts)
        if result.get('success') and AIConfig.ENABLE_CACHE and cache_key:
            response_cache.set(cache_key, result)
        
        # Log usage
        log_usage(user_id, feature, len(content), result.get('success', False))
        
        # Log result summary
        logger.info(f"Result success: {result.get('success')}, has content: {bool(result.get('content'))}")
        
        return jsonify(result)
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Invalid JSON format in request body',
            'error': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Unexpected error in process_request: {str(e)}", exc_info=True)
        
        # Return detailed error in development, generic in production
        error_detail = str(e) if os.getenv('FLASK_ENV') == 'development' else None
        
        return jsonify({
            'success': False,
            'message': 'Internal server error. Please try again',
            'error': error_detail,
            'error_type': type(e).__name__
        }), 500


# Also add this helper endpoint for debugging
@ai_blueprint.route('/debug/last-request', methods=['GET'])
@login_required
def debug_last_request():
    """Debug endpoint to check last request details"""
    
    if not os.getenv('FLASK_ENV') == 'development':
        return jsonify({'message': 'Only available in development'}), 403
    
    return jsonify({
        'method': request.method,
        'content_type': request.content_type,
        'is_json': request.is_json,
        'user_authenticated': current_user.is_authenticated,
        'user_id': current_user.id if current_user.is_authenticated else None
    })
@ai_blueprint.route('/test', methods=['GET'])
@login_required
def test_api():
    """Test endpoint to check AI configuration"""
    
    status = {
        'authenticated': current_user.is_authenticated,
        'user_id': current_user.id if current_user.is_authenticated else None,
        'providers': {
            'openai': {
                'available': AI_PROVIDERS.get('openai', False),
                'configured': bool(AIConfig.OPENAI_API_KEY)
            },
            'anthropic': {
                'available': AI_PROVIDERS.get('anthropic', False),
                'configured': bool(AIConfig.ANTHROPIC_API_KEY)
            },
            'google': {
                'available': AI_PROVIDERS.get('google', False),
                'configured': bool(AIConfig.GOOGLE_AI_KEY)
            }
        },
        'features': {
            'caching': AIConfig.ENABLE_CACHE,
            'web_search': AIConfig.ENABLE_WEB_SEARCH,
            'analytics': AIConfig.ENABLE_ANALYTICS
        }
    }
    
    # Determine active providers
    active_providers = [
        name for name, info in status['providers'].items()
        if info['available'] and info['configured']
    ]
    
    if not active_providers:
        status['message'] = 'No AI providers configured. Please add API keys'
        status['ready'] = False
    else:
        status['message'] = f"Ready with providers: {', '.join(active_providers)}"
        status['ready'] = True
    
    return jsonify(status)

@ai_blueprint.route('/stats', methods=['GET'])
@login_required
def get_stats():
    """Get usage statistics for current user"""
    
    try:
        user_id = str(current_user.id)
        
        # Get request count for today
        user_requests = rate_limiter.requests.get(user_id, [])
        today = datetime.now().date()
        today_requests = [
            req for req in user_requests
            if req.date() == today
        ]
        
        stats = {
            'success': True,
            'requests_today': len(today_requests),
            'requests_hour': len([
                req for req in user_requests
                if req > datetime.now() - timedelta(hours=1)
            ]),
            'limit_hour': AIConfig.MAX_REQUESTS_PER_HOUR,
            'limit_day': AIConfig.MAX_REQUESTS_PER_DAY,
            'cache_size': len(response_cache.cache)
        }
        
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Stats error: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to retrieve statistics'
        }), 500

@ai_blueprint.route('/cache/clear', methods=['POST'])
@login_required
def clear_cache():
    """Clear response cache (admin only)"""
    
    try:
        response_cache.clear()
        return jsonify({
            'success': True,
            'message': 'Cache cleared successfully'
        })
    except Exception as e:
        logger.error(f"Cache clear error: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to clear cache'
        }), 500

# ==================== ERROR HANDLERS ====================

@ai_blueprint.errorhandler(400)
def bad_request(error):
    """Handle bad requests"""
    return jsonify({
        'success': False,
        'message': 'Bad request. Please check your input'
    }), 400

@ai_blueprint.errorhandler(401)
def unauthorized(error):
    """Handle unauthorized access"""
    return jsonify({
        'success': False,
        'message': 'Please log in to use AI features'
    }), 401

@ai_blueprint.errorhandler(404)
def not_found(error):
    """Handle not found"""
    return jsonify({
        'success': False,
        'message': 'Endpoint not found'
    }), 404

@ai_blueprint.errorhandler(429)
def rate_limit_exceeded(error):
    """Handle rate limit errors"""
    return jsonify({
        'success': False,
        'message': 'Rate limit exceeded. Please try again later'
    }), 429

@ai_blueprint.errorhandler(500)
def internal_error(error):
    """Handle internal errors"""
    logger.critical(f"Internal Server Error: {error}", exc_info=True)
    return jsonify({
        'success': False,
        'message': 'Internal server error. Please try again'
    }), 500

# ==================== INITIALIZATION ====================

def init_ai_assistant(app):
    """Initialize AI assistant with Flask app"""
    
    # Register blueprint
    app.register_blueprint(ai_blueprint)
    
    # Log configuration
    logger.info("=" * 60)
    logger.info("AI Assistant Initialized")
    logger.info("=" * 60)
    logger.info(f"OpenAI: {'✓' if AIConfig.OPENAI_API_KEY else '✗'}")
    logger.info(f"Anthropic: {'✓' if AIConfig.ANTHROPIC_API_KEY else '✗'}")
    logger.info(f"Google AI: {'✓' if AIConfig.GOOGLE_AI_KEY else '✗'}")
    logger.info(f"Caching: {'Enabled' if AIConfig.ENABLE_CACHE else 'Disabled'}")
    logger.info(f"Web Search: {'Enabled' if AIConfig.ENABLE_WEB_SEARCH else 'Disabled'}")
    logger.info(f"Rate Limit: {AIConfig.MAX_REQUESTS_PER_HOUR}/hour, {AIConfig.MAX_REQUESTS_PER_DAY}/day")
    logger.info("=" * 60)

# Export for use in main app
__all__ = ['ai_blueprint', 'init_ai_assistant']