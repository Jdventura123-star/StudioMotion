(function () {
  var activeScript = document.currentScript;
  var revealTargets = [
    ".video-wrap",
    ".section-head",
    ".section-copy",
    ".card",
    ".proof",
    ".coach-card",
    ".coach-profile",
    ".story-panel",
    ".channel-card",
    ".board-photo",
    ".quote",
    ".fit-card",
    ".cta .container",
    ".plan",
    ".pricing-note"
  ];

  var nodes = Array.prototype.slice.call(document.querySelectorAll(revealTargets.join(",")));
  nodes.forEach(function (node, index) {
    node.classList.add("reveal");
    node.style.transitionDelay = Math.min(index % 6, 5) * 70 + "ms";
  });

  Array.prototype.slice.call(document.querySelectorAll(".fit-card")).forEach(function (card) {
    Array.prototype.slice.call(card.querySelectorAll("li")).forEach(function (item, index) {
      item.style.transitionDelay = 120 + index * 85 + "ms";
    });
  });

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.01, rootMargin: "0px" });

    nodes.forEach(function (node) {
      observer.observe(node);
    });
  } else {
    nodes.forEach(function (node) {
      node.classList.add("is-visible");
    });
  }

  window.addEventListener("pointermove", function (event) {
    document.documentElement.style.setProperty("--mx", event.clientX + "px");
    document.documentElement.style.setProperty("--my", event.clientY + "px");

    var themedTarget = event.target.closest && event.target.closest(".theme-ventura, .theme-gordie, .theme-isaiha, .theme-vey");
    if (themedTarget) {
      var coachRgb = getComputedStyle(themedTarget).getPropertyValue("--coach-rgb").trim();
      if (coachRgb) {
        document.documentElement.style.setProperty("--cursor-rgb", coachRgb);
      }
    } else {
      document.documentElement.style.setProperty("--cursor-rgb", "168, 85, 247");
    }
  }, { passive: true });

  async function loadCachedYouTubeSubscriberCounts() {
    var cards = Array.prototype.slice.call(document.querySelectorAll("[data-youtube-handle]"));
    if (!cards.length) return;

    try {
      var scriptUrl = new URL(activeScript ? activeScript.getAttribute("src") : "script.js", window.location.href);
      var siteRoot = new URL(".", scriptUrl);
      var response = await fetch(new URL("data/channel-counts.json", siteRoot).toString(), { cache: "no-store" });
      if (!response.ok) return;

      var payload = await response.json();
      cards.forEach(function (card) {
        var handle = card.getAttribute("data-youtube-handle");
        var countNode = card.querySelector(".channel-count");
        var channel = payload.channels && payload.channels[handle];
        if (!countNode || !channel || !channel.subscriberText) return;
        countNode.textContent = channel.subscriberText;
        if (channel.updatedAt) {
          countNode.setAttribute("title", "Updated " + new Date(channel.updatedAt).toLocaleDateString());
        }
      });
    } catch (error) {
      return;
    }
  }

  loadCachedYouTubeSubscriberCounts();
})();
