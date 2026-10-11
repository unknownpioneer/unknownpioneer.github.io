---
layout: post
title: "Embarking On New Journey - 3-year struggling coming up"
date: 2023-08-31
author: "BEUFK"
category: "Life log"
---

<figure>
  <img src="{{ '/image/expiration_date_10.jpg' | relative_url }}" alt="ME NOTHING TO SAY. JUST WANT RELAX AND PLAY." />
</figure>

We're keeping track of what we are facing up in new environment.

<section class="status-panel" aria-labelledby="pressure-title" aria-live="polite">
  <h3 id="pressure-title">Pressure Value</h3>
  <progress id="pressure-progress" value="0" max="100">0%</progress>
  <p id="percentage">0%</p>
  <p id="status-message">Status pending...</p>
</section>

Main Objectives:

1. Being admissed by targeted college.
2. Acting as the desired thing.
3. Making new friends.

<script>
  const percent = Math.ceil(Math.random() * 100);
  const progress = document.getElementById("pressure-progress");
  const percentage = document.getElementById("percentage");
  const statusMessage = document.getElementById("status-message");

  progress.value = percent;
  percentage.textContent = `${percent}%`;

  if (percent > 80) {
    statusMessage.textContent = "I'm gonna crazy!";
  } else {
    statusMessage.textContent = "I'm OKay.";
  }
</script>
