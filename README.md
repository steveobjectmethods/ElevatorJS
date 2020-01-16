## Elevator System Simulation in Javascript

This is an interactive elevator system simulation implemented in Javascript (ES6).  Its been tested on current desktop versions of Chrome and Safari and also Safari on iPhone 7 plus.

Website running this code is [here](https://steveobjectmethods.github.io/ElevatorJS).

The type of elevator system that is being simulated has call buttons outside the elevators to make up/down requests.  There are elevator systems where you can enter a destination floor outside the elevator but this implementation does not model that type of system.

The user can click on up/down call buttons (the triangles) and these requests will be dispatched to the elevators.  The floor button pressed by the passenger after she enters the elevator is randomized.  Note that this doesn't model the scenario where a group of people press a call button and each gets in and presses a different destination floor.

Elevator acceleration and deceleration is modeled.  Door open/close/pause at open are modeled.

The metrics displayed at the top are:
1. Ave Wait Time - the average time a passenger has to wait to be picked up
2. Ave Travel Time - the average time a passenger is inside an elevator
3. Ave Total Time - the average time between call button press and arrival at destination

## Future work

Instead of or in addition to the manual call button click requests, this simulation could be driven by a traffic model that contains call requests by time of day.

Dropoff floors could also be driven by a historical traffic model.  Currently, the probability of dropoff is equal for all possible destination floors (e.g., if it is an up call request, only possible destinations are floors above).

Elevators could be prepositioned (e.g., send all elevators to the ground floor when they are idle to pick up passengers during morning arrival to work).

### Personal website

Please visit my personal [website](https://ctoinsight.com/) for posts on software and technology management.
