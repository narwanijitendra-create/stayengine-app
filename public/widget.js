(function () {
  var scriptTag = document.currentScript;
  var hotelSlug = scriptTag.getAttribute("data-hotel");
  var platformOrigin = new URL(scriptTag.src).origin;

  if (!hotelSlug) {
    console.error("StayEngine widget: missing data-hotel attribute");
    return;
  }

  var iframe = document.createElement("iframe");
  iframe.src = platformOrigin + "/widget/" + hotelSlug;
  iframe.style.width = "100%";
  iframe.style.minHeight = "640px";
  iframe.style.border = "none";
  iframe.setAttribute("title", "Book direct");

  var mountId = scriptTag.getAttribute("data-target");
  var mount = mountId ? document.getElementById(mountId) : null;
  (mount || scriptTag.parentNode).appendChild(iframe);
})();
