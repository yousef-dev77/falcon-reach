-- إضافة foreign keys للربط بين الجداول
-- ملاحظة: user_id في user_roles يشير إلى profiles.id وليس auth.users.id

-- أولاً نتحقق من الـ constraint الموجود ونحذفه إذا كان يشير لـ auth.users
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.user_branch_assignments 
DROP CONSTRAINT IF EXISTS user_branch_assignments_user_id_fkey;

-- إضافة FK جديد يشير لـ profiles
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.user_branch_assignments 
ADD CONSTRAINT user_branch_assignments_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;