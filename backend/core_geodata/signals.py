from django.db.models.signals import pre_save
from django.dispatch import receiver
# from django.contrib.gis.geos import Point # Requires GDAL
from .models import GeoData

@receiver(pre_save, sender=GeoData)
def sync_location(sender, instance, **kwargs):
    pass
    # if instance.latitude is not None and instance.longitude is not None:
    #     instance.location = Point(instance.longitude, instance.latitude, srid=4326)
