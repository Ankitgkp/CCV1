import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Star, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Review() {
  const [, setLocation] = useLocation();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const { toast } = useToast();

  const handleSubmit = () => {
    if (rating === 0) {
      toast({ title: "Please select a rating", variant: "destructive" });
      return;
    }
    toast({ 
      title: "Thank you for your feedback!", 
      description: `You rated ${rating} stars`,
      className: "bg-green-500 text-white border-none"
    });
    setTimeout(() => {
      setLocation("/home");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Success Icon */}
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <div className="text-5xl flex items-center justify-center text-green-600">
            <Check className="w-16 h-16" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center mb-2">Trip Completed!</h1>
        <p className="text-slate-500 text-center mb-8">Thank you for riding with us</p>

        {/* Rating */}
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-100 mb-6">
          <p className="text-center font-bold text-slate-900 mb-4">How was your ride?</p>
          
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 transition-colors ${
                    star <= (hoveredRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-slate-300"
                  }`}
                />
              </button>
            ))}
          </div>

          <p className="text-center text-sm text-slate-500">
            {rating === 0 && "Tap to rate"}
            {rating === 1 && "Poor"}
            {rating === 2 && "Fair"}
            {rating === 3 && "Good"}
            {rating === 4 && "Great"}
            {rating === 5 && "Excellent!"}
          </p>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          className="w-full h-14 bg-black text-white rounded-2xl text-lg font-bold"
        >
          Submit Review
        </Button>

        <button
          onClick={() => setLocation("/home")}
          className="w-full mt-4 text-slate-500 font-medium text-sm"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

