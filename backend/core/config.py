from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", "../.env.local"),  # .env.local sobreescribe .env
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # WispHub
    wisphub_api_base_url: str
    wisphub_api_key: str

    # Base de datos
    database_url: str

    # Redis (opcional, no se usa actualmente)
    redis_url: str = ""

    # App
    app_env: str = "development"
    app_secret_key: str
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # WhatsApp API
    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_business_account_id: str = ""
    whatsapp_contact_phone: str = ""

settings = Settings()
