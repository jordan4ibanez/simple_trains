# simple_trains
 Simple trains.

# To build:

```
npm install

make
```

1.) ~~node by node travel 1 rail car~~

2.) ~~interpolate between the nodes 1 rail car~~

3.) go uphill

4.) go downhill

5.) reverse direction

5.5) turn this test entity into a mine cart

6.) double bogey entities so more detailed trains can ride the rails

7.) add a rail car

8.) find a way for rail car to follow train

9.) find a way to disconnect the train from the locomotive if a player messes with the rails

interpolation notation

```
  | Currently in middle
\___

    | Possibly could use forward vector to subtract a 0.5 vector from it to interpolate from edge to edge
\___

this could be used for uphills. Needs to be studied though. Will probably break turns though. Might be able to do turns by literally turning but that is a lot of work.

Cost of redesigning the entire thing for uphill to look slightly better vs just living with the jank

```