"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Settings, Save, RefreshCw, AlertCircle, Loader2, Lock } from "lucide-react";

interface SystemSetting {
  settingKey: string;
  settingValue: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/system-settings");
      setSettings(res.data);
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateValue = (key: string, newValue: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.settingKey === key ? { ...s, settingValue: newValue } : s)),
    );
  };

  const saveSetting = async (setting: SystemSetting) => {
    try {
      setSavingKey(setting.settingKey);
      await api.put(`/system-settings/${setting.settingKey}`, setting.settingValue, {
        headers: { "Content-Type": "text/plain" },
      });
      toast.success("Setting updated successfully.", {
        description: `The setting ${setting.settingKey} has been updated.`,
        closeButton: true,
      });
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setSavingKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#5865F2]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#5865F2]" />
            System Settings
          </h1>
          <p className="text-[#80848E] text-sm mt-1">
            Configure global parameters for the MicDrop platform.
          </p>
        </div>
        <button
          onClick={fetchSettings}
          className="p-2 text-[#80848E] hover:text-white transition-colors"
          title="Refresh settings"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settings.map((setting) => (
          <div
            key={setting.settingKey}
            className="bg-[#2B2D31] border border-[#1E1F22] rounded-xl p-5 flex flex-col justify-between hover:border-[#35373C] transition-all"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#80848E] uppercase tracking-wider">
                  Setting Key
                </label>
                <span title="Keys cannot be changed" className="flex items-center">
                  <Lock className="w-3 h-3 text-[#4E5058]" />
                </span>
              </div>
              <h3 className="text-white font-mono text-sm bg-[#1E1F22] px-2 py-1 rounded inline-block">
                {setting.settingKey}
              </h3>

              <div className="pt-2">
                <label className="block text-xs font-bold text-[#80848E] uppercase mb-2">
                  Value
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={setting.settingValue}
                  onChange={(e) => handleUpdateValue(setting.settingKey, e.target.value)}
                  className="w-full bg-[#1E1F22] border border-[#1E1F22] text-[#DBDEE1] rounded-md px-3 py-2 outline-none focus:border-[#5865F2] transition-all text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <button
                onClick={() => saveSetting(setting)}
                disabled={savingKey === setting.settingKey}
                className="bg-[#5865F2] hover:bg-[#4752C4] disabled:bg-[#4E5058] text-white px-4 py-2 rounded-md text-xs font-bold flex items-center gap-2 transition-colors uppercase tracking-tight"
              >
                {savingKey === setting.settingKey ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                {savingKey === setting.settingKey ? "Saving..." : "Save Change"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {settings.length === 0 && (
        <div className="bg-[#2B2D31] rounded-xl border border-dashed border-[#4E5058] p-12 text-center">
          <AlertCircle className="w-12 h-12 text-[#4E5058] mx-auto mb-4" />
          <p className="text-[#80848E]">No system settings found in the database.</p>
        </div>
      )}
    </div>
  );
}
