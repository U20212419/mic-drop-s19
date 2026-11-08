interface DropdownOptionSelectorProps {
  judge: any;
  contestantData: any;
  handleOptionChange: (discordId: string, val: string) => void;
}

export function DropdownOptionSelector({
  judge,
  contestantData,
  handleOptionChange,
}: DropdownOptionSelectorProps) {
  if (!contestantData.hasDropdownOptions) return null;

  return (
    <div className="mt-3">
      <label className="block text-xs text-[#80848E] font-bold uppercase mb-1">Select Option</label>
      <select
        value={judge.selectedOption || ""}
        onChange={(e) => handleOptionChange(judge.discordId, e.target.value)}
        className="w-full bg-[#1E1F22] border border-[#35373C] text-[#DBDEE1] rounded-md px-4 py-3 outline-none focus:border-[#5865F2]"
      >
        <option value="" disabled>
          Select an option...
        </option>
        {contestantData.dropdownOptions?.map((opt: string) => {
          const usedInGroup = contestantData.optionUsageCounts?.[opt] || 0;
          const localUsage = contestantData.judges.filter(
            (j: any) => j.discordId !== judge.discordId && j.selectedOption === opt,
          ).length;

          const totalUsage = usedInGroup + localUsage;
          const max = contestantData.maxSelectionsPerOption;

          const hasLimit = max !== null && max !== undefined && max > 0;
          const isExhausted = hasLimit && totalUsage >= max;

          const disabledByRepeat = !contestantData.allowDropdownRepeat && localUsage > 0;

          const disabled = isExhausted || disabledByRepeat;

          let labelText = opt;
          if (hasLimit) {
            const remaining = Math.max(0, max - totalUsage);
            labelText += ` (${remaining} remaining)`;
          }

          if (isExhausted) {
            labelText += " - Exhausted";
          } else if (disabledByRepeat) {
            labelText += " - Already selected by you";
          }

          return (
            <option key={opt} value={opt} disabled={disabled}>
              {labelText}
            </option>
          );
        })}
      </select>
    </div>
  );
}
