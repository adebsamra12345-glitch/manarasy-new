from django.apps import AppConfig


class CoreGeodataConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core_geodata'

    def ready(self):
        import core_geodata.signals
