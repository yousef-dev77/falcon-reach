import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user } = useAuth();
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">مرحباً بك في نظام فالكون ERP</h1>
        <p className="text-muted-foreground">
          مرحباً {user?.email}، يمكنك الآن البدء في استخدام النظام
        </p>
      </div>
    </div>
  );
};

export default Index;
