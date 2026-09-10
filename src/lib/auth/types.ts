export type AppRole = "master" | "worker";

export type Profile = {
  id: string;
  organization_id: string;
  role: AppRole;
  full_name: string;
  employee_code: string | null;
  active: boolean;
};

export type AuthContext = {
  user: {
    id: string;
    email: string | null;
  };
  profile: Profile;
};
