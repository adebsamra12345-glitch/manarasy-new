"""إعدادات خدمة الـ Orchestrator — تُقرأ بالكامل من متغيرات البيئة دون قيم صلبة حساسّة."""
import os
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
PROMPTS_DIR = Path(os.getenv("PROMPTS_DIR", str(BASE_DIR / "prompts")))


@dataclass
class Settings:
    service_key: str = ""
    vllm_base_url: str = ""
    vllm_model_name: str = "base"  # للتوافق: قيمة AGENT الافتراضية إن لم يُضبط VLLM_MODEL_AGENT
    vllm_model_agent: str = "manarasy"
    vllm_model_text: str = "base"
    vllm_model_fallback: str = "base"
    # نموذج كل نقطة نهاية قابل للضبط (تُستخدم للمقارنة A/B قبل تثبيت القرار)
    vllm_model_evaluation_note: str = ""   # فارغ = TEXT
    vllm_model_report_insight: str = ""    # فارغ = TEXT
    stt_base_url: str = ""
    stt_model_name: str = "deepdml/faster-whisper-large-v3-turbo-ct2"

    agent_backend: str = "mock"
    django_base_url: str = "http://127.0.0.1:8000"
    agent_jwt_secret: str = ""

    llm_timeout_seconds: float = 25.0
    stt_timeout_seconds: float = 15.0
    llm_max_retries: int = 2
    llm_retry_backoff_seconds: float = 0.5
    cb_failure_threshold: int = 3
    cb_recovery_timeout_seconds: float = 30.0

    max_request_body_bytes: int = 65536
    max_audio_upload_bytes: int = 10 * 1024 * 1024
    max_input_chars: int = 4000
    max_output_tokens: int = 512
    default_temperature: float = 0.2

    rate_limit_window_seconds: int = 60
    rate_limit_student_per_min: int = 10
    rate_limit_teacher_per_min: int = 30
    rate_limit_manager_per_min: int = 45
    rate_limit_admin_per_min: int = 60

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            service_key=os.getenv("ORCHESTRATOR_SERVICE_KEY", ""),
            vllm_base_url=os.getenv("VLLM_BASE_URL", "http://100.119.62.40:8000/v1").rstrip("/"),
            vllm_model_name=os.getenv("VLLM_MODEL_NAME", "base"),
            vllm_model_agent=os.getenv("VLLM_MODEL_AGENT") or os.getenv("VLLM_MODEL_NAME") or "manarasy",
            vllm_model_text=os.getenv("VLLM_MODEL_TEXT", "base"),
            vllm_model_fallback=os.getenv("VLLM_MODEL_FALLBACK", "base"),
            vllm_model_evaluation_note=os.getenv("VLLM_MODEL_EVALUATION_NOTE", ""),
            vllm_model_report_insight=os.getenv("VLLM_MODEL_REPORT_INSIGHT", ""),
            stt_base_url=os.getenv("STT_BASE_URL", "http://100.119.62.40:8001/v1").rstrip("/"),
            stt_model_name=os.getenv("STT_MODEL_NAME", "deepdml/faster-whisper-large-v3-turbo-ct2"),
            agent_backend=os.getenv("AGENT_BACKEND", "mock"),
            django_base_url=os.getenv("DJANGO_BASE_URL", "http://127.0.0.1:8000").rstrip("/"),
            agent_jwt_secret=os.getenv("AGENT_JWT_SECRET", "dev-only-secret-change-me"),
            llm_timeout_seconds=float(os.getenv("LLM_TIMEOUT_SECONDS", "25.0")),
            stt_timeout_seconds=float(os.getenv("STT_TIMEOUT_SECONDS", "15.0")),
            llm_max_retries=int(os.getenv("LLM_MAX_RETRIES", "2")),
            llm_retry_backoff_seconds=float(os.getenv("LLM_RETRY_BACKOFF_SECONDS", "0.5")),
            cb_failure_threshold=int(os.getenv("CB_FAILURE_THRESHOLD", "3")),
            cb_recovery_timeout_seconds=float(os.getenv("CB_RECOVERY_TIMEOUT_SECONDS", "30.0")),
            max_request_body_bytes=int(os.getenv("MAX_REQUEST_BODY_BYTES", "65536")),
            max_audio_upload_bytes=int(os.getenv("MAX_AUDIO_UPLOAD_BYTES", str(10 * 1024 * 1024))),
            max_input_chars=int(os.getenv("MAX_INPUT_CHARS", "4000")),
            max_output_tokens=int(os.getenv("MAX_OUTPUT_TOKENS", "512")),
            default_temperature=float(os.getenv("DEFAULT_TEMPERATURE", "0.2")),
            rate_limit_window_seconds=int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60")),
            rate_limit_student_per_min=int(os.getenv("RATE_LIMIT_STUDENT_PER_MIN", "10")),
            rate_limit_teacher_per_min=int(os.getenv("RATE_LIMIT_TEACHER_PER_MIN", "30")),
            rate_limit_manager_per_min=int(os.getenv("RATE_LIMIT_MANAGER_PER_MIN", "45")),
            rate_limit_admin_per_min=int(os.getenv("RATE_LIMIT_ADMIN_PER_MIN", "60")),
        )


def get_settings() -> Settings:
    return Settings.from_env()

