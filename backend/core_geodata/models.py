from django.db import models
# from django.contrib.gis.db import models # Requires GDAL

class GeoData(models.Model):
    # Maintaining current fields
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    
    # New PostGIS column (Commented out until GDAL is installed on Windows)
    # location = models.PointField(geography=True, srid=4326, null=True, blank=True)
    
    class Meta:
        db_table = 'core_geodata'
        # indexes = [
        #     models.Index(fields=['location'], name='idx_geodata_location'),
        # ]
