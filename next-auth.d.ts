import "next-auth";

declare module "next-auth" {
  /**
   * Extending the built-in session/user types
   * to include the fields used by the application.
   */
  interface User {
      name: string | null | undefined; 
      email: string | null | undefined; 
      image: string | null | undefined; 
      id?: string;
      boughtCredits?: number;
      usedCredits?: number;
      credits?:number;   
      fans?:number;
      grade?:number;
      actors?:string;  
  }

  interface Session {
    user: User;
  }
}
