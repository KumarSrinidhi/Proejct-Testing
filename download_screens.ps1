$urls = @{
    "login"            = "https://lh3.googleusercontent.com/aida/ADBb0ujgIvGgApny8LdrCspDTCM-SW6BGqPc5fEUkE88rZFNQXzNv7hdippqDbiGO66_H0B7PDXlgvv_EtgF5z-caLMBVR6ALEzLnuYdYeVkw7E6FUc_Sd-PKfQXofL3qcI1dwLZWDrjmM9UH8AdtJ9W6oqZyyP2GMhdzMqlNMMY2mN3CnYe2jgoGV5EeMsOvmKPVbw6yLc8LSFCpMh-vxxAEj6pnvDW_w5Q_GNY_m5957HsOLsC2aUC2zPWsdI=w2560"
    "dashboard"        = "https://lh3.googleusercontent.com/aida/ADBb0ugiFyEiNVrFJ-fj_h6vNNBaO_nZxHtnaWhdFrlCXJQK-XHqNv1RvPKuYj-JkuDbdbICueIhE7ZcrhsovqQ3ydPxY8jp7EbjCf73tTmLj6W6OmIPTokFofW5JeltP3I0IVSbWPDxCfu6otui_ib8OD2EHbx5DrNp1AxfmNSy_Vx6yMGPIa_lxx4kYAqcYmS_i07QT5_14R0cOwnsqSdTztQJy7iWfBsgIobZCEToE8_Tw7pMd5RTm0vzAAY=w3072"
    "live-recognition" = "https://lh3.googleusercontent.com/aida/ADBb0uhNNvBCNhc4xvf11Qh3NDjvWYNvigK9CxBFeEivoQi5u7NBo_yc6LV_gMVlfugX46PrKOjslay_uUCANa3tJfiX--oLOSHqzAgy76kG5GPj5Nq_EzkmkFdIMLVwCm4-NNWDwTKUqS6pPcEtgmBHMmz3_tUTvPsFC4gSRMR5lu6GmCCu1wtpK2D0wp6oB8BU8k1sgLGDZvHEGBoDirJf5vhhCGNR46ox6g1JLm35NYxSmRygTrCaYPsEXM8=w2816"
}

foreach ($name in $urls.Keys) {
    $out = ".stitch\designs\$name.png"
    Write-Host "Downloading $name..."
    Invoke-WebRequest -Uri $urls[$name] -OutFile $out -UseBasicParsing
    Write-Host "Saved: $out"
}
Write-Host "All done."
