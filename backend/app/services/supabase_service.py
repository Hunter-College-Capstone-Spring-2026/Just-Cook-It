from supabase import create_client
from app.utils.config import SUPABASE_URL, SUPABASE_ANON_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def get_supabase():
    return supabase

# test function to check if we can connect to the database and retrieve dietary restrictions
def get_dietary_restrictions():
    response = supabase.table("DietaryRestriction").select("*").execute()
    if response.data is None:
        return []
    return response.data