---
layout: collection
title: "Portfolio"
permalink: /portfolio/
collection: projects
entries_layout: grid
classes: wide
author_profile: true
---

Welcome to my portfolio. Here you can find a showcase of my latest projects and contributions.

{% assign projects = site.projects | sort: 'date' | reverse %}
<div class="entries-{{ page.entries_layout | default: 'list' }}">
  {% for project in projects %}
    {% include archive-single.html type=page.entries_layout %}
  {% endfor %}
</div>
