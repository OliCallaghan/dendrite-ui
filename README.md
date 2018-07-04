# Dendrite
## What is Dendrite?
Dendrite is a new concept developed to allow users to train neural networks without requiring a single line of code to be written. Networks are constructed by dragging and dropping layers together, to construct a graph which can then be trained using user defined training data. Once trained, these networks can then be tested for their accuracy. The machine learning engine was written entirely from scratch using C++ and OpenCL, allowing the GPU to be used when executing networks, whilst the user interface was designed and developed using HTML, CSS, JS and Electron.

![Dendrite Network](http://olicallaghan.com/img/projects/dendrite.png)

# Dendrite UI
## What is Dendrite UI?
Dendrite UI is the user interface for Dendrite, allowing users to structure, implement and develop neural networks with a drag and drop interface. Once a network is designed, then it can be trained directly from the interface, with useful metrics shown to ensure the network is optimising correctly.

## How do I get started?
Firstly, you will need the [Dendrite Engine](https://github.com/OliCallaghan/dendrite-engine), which has installation instructions in its README. You will also need to clone this repository (duh :P)

Once you have moved the compiled engine to the `dendrite-ui/executables/`,`cd` into the repository, and run:

```npm i && npm start```

This should install all dependencies, and launch the Electron application.

## How do I use it?
I have prepared a 'Getting Started Guide' in the [documentation](http://olicallaghan.com/dendrite/dendrite.pdf) available on my website.

---

Copyright (c) Oliver Easton Callaghan 2018
