from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # WispHub
    wisphub_api_base_url: str
    wisphub_api_key: str

    # Base de datos
    database_url: str

    # Redis
    redis_url: str

    # App
    app_env: str = "development"
    app_secret_key: str

	# WhatsApp
    whatsapp_token: str
    whatsapp_phone_number_id: str
    whatsapp_business_account_id: str

settings = Settings()
