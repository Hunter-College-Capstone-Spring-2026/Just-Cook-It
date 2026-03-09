from supabase import create_client
from app.utils.config import settings

supabase = create_client(settings.supabase_url, settings.supabase_anon_key)

def get_supabase():
    return supabase

# test function to check if we can connect to the database and retrieve dietary restrictions
def get_dietary_restrictions():
    response = supabase.table("DietaryRestriction").select("*").execute()
    if response.data is None:
        return []
    return response.data