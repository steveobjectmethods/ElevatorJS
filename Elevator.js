/*
@licstart  The following is the entire license notice for the
JavaScript code in this page.

Copyright (C) 2020  Stephen V. Kowalski
steve@objectmethods.com

The JavaScript code in this page is free software: you can
redistribute it and/or modify it under the terms of the GNU
General Public License (GNU GPL) as published by the Free Software
Foundation, either version 3 of the License, or (at your option)
any later version.  The code is distributed WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE.  See the GNU GPL for more details.

As additional permission under GNU GPL version 3 section 7, you
may distribute non-source (e.g., minimized or compacted) forms of
that code without the copy of the GNU GPL normally required by
section 4, provided you include this license notice and a URL
through which recipients can access the Corresponding Source.

@licend  The above is the entire license notice
for the JavaScript code in this page.
*/

// elevator system configuration
const numElevators = 4;
const numFloors = 8; // when viewed in the browser, floor 0 in the code is the top floor but the floor labels displayed are not the same as the code

// state variables
let elevator = []; // 1-D array of elevator objects
let floorsWaitingUp = [];   // state for up call buttons
let floorsWaitingDown = []; // state for down call buttons
let openCallRequests = [];  // call requests that have not been assigned to an elevator
let elevatorRequests = [];  // all requests
let pickedUpRequests = [];  // requests that have been picked up (including completed requests)
let completedRequests = []; // requests that have been completed

// coordinates for drawing
const canvasWidth = 375;
const canvasHeight = 600;
const metricsLocationY = 30;
const instructionsLocationY = 560;
const waitTimeMetricX = 10;
const travelTimeMetricX = 130;
const totalTimeMetricX = 260;
const firstFloorLocationY = 50;
let floorLocationY = [];
const spaceBetweenFloors = 60;
const elevatorHeight = 50;
const elevatorWidth = 50;
const spaceBetweenElevators = 20;
const callButtonWidth = 20;
const callButtonHeight = 20;
const callButtonUpLocationX = spaceBetweenElevators + numElevators * (spaceBetweenElevators + elevatorWidth);
const callButtonDownLocationX = callButtonUpLocationX + callButtonWidth;
let upCallButtonCoords = [];
let downCallButtonCoords = [];
let floorNumberCoords = [];

// elevator dynamics
const maxSpeedUp = -0.8; // units are pixels per interval
const maxSpeedDown = 0.8; // units are pixels per interval
const minSpeedUp = -0.07; // units are pixels per interval
const minSpeedDown = 0.07; // units are pixels per interval
const doorSpeed = 0.01; // units are percentage open per interval
const acceleration = 0.01; // units are pixels per interval per interval
const distToStopUp = maxSpeedUp*maxSpeedUp/(2*acceleration); // in pixels
const distToStopDown = maxSpeedDown*maxSpeedDown/(2*acceleration); // in pixels

// colors and fonts
const callPressedColor = "Green";
const callNotPressedColor = "Grey";
const elevatorColor = "#990000";
const doorOpenColor = "White";
const metricTextColor = "Black";
const floorNumColor = "Black";
const elevatorTextColor = "White";
const elevatorFont = "11px Arial";
const floorNumFont = "25px Arial";
const metricsFont = "15px Arial";

// animiation
const intervalsToLeaveDoorOpen = 60; // simulating people going in and out
const updateInterval = 20; // in ms
const millisecPerSec = 1000; // 1000 ms in a second
let clock = 0;

// state of the up/down call buttons for each floor
const FloorWaitingState = {
    NO_REQUEST: 0,
    OPEN_REQUEST: 1,
    DISPATCHED: 2
}

const CallRequestDirection = {
    UP: 0,
    DOWN: 1
}

// mechanical states of the elevator
const TravelState = {
    MOVING_UP: 0,
    MOVING_DOWN: 1,
    STOPPED_OPEN: 2,
    STOPPED_CLOSED: 3,
    STOPPED_OPENING: 4,
    STOPPED_CLOSING: 5
}

// states that describe at a higher level what the elevator is doing
const ObjectiveState = {
    UP_SWEEP: 1,
    DOWN_SWEEP: 2,
    MOVING_TO_UP_SWEEP: 3,
    MOVING_TO_DOWN_SWEEP: 4,
    IDLE: 0
}

const elevatorSystemMetrics = {
    numReqToAveOver: 10, // number of elevator requests (trips) to average over
    aveWaitTime: 0, // average time a user has to wait before an elevator arrives to pick her up, in seconds
    aveTravelTime: 0, // average time a user spends inside an elevator, in seconds
    aveTotalTime: 0, // average total time a user spends between pressing a call button and arriving at her floor, in seconds

    updatePickedUpMetrics(pickedUpRequests,updateIntervalMS)
    {
        let reqNum;

        for (reqNum = 0, this.aveWaitTime = 0; (reqNum < this.numReqToAveOver) && (reqNum < pickedUpRequests.length); ++reqNum) {
            this.aveWaitTime += pickedUpRequests[reqNum].waitTime();
        }
        if (reqNum > 0) {
            this.aveWaitTime = Math.ceil(((this.aveWaitTime / reqNum) / millisecPerSec) * updateIntervalMS);
        }
    },

    updateCompletedMetrics(completedRequests,updateIntervalMS) {
        let reqNum;

        for (reqNum = 0, this.aveTravelTime = 0, this.aveTotalTime = 0; (reqNum < this.numReqToAveOver) && (reqNum < completedRequests.length); ++reqNum) {
            this.aveTravelTime += completedRequests[reqNum].travelTime();
            this.aveTotalTime += completedRequests[reqNum].totalTime();
        }
        if (reqNum > 0) {
            this.aveTravelTime = Math.ceil(((this.aveTravelTime / reqNum) / millisecPerSec) * updateIntervalMS);
            this.aveTotalTime = Math.ceil(((this.aveTotalTime / reqNum) / millisecPerSec) * updateIntervalMS);
        }
    }
}

// called once when the page loads
function startElevatorSystem() {
    elevatorSystem.initFloors();
    elevatorSystem.initElevators();
    elevatorSystem.initCanvas();
    elevatorSystem.start();
}

const elevatorSystem = {
    canvas: null,

    //canvas : document.createElement("canvas"), // canvas is an area to draw on

    initFloors: function() {
        for (let floor = 0; floor < numFloors; ++floor) {

            floorLocationY.push(floor===0?firstFloorLocationY:(floor+1)*spaceBetweenFloors);
            floorsWaitingUp.push(FloorWaitingState.NO_REQUEST);
            floorsWaitingDown.push(FloorWaitingState.NO_REQUEST);
            (floor === 0) ? upCallButtonCoords.push(null): // no upcall button on top floor
                upCallButtonCoords.push([[callButtonUpLocationX, floorLocationY[floor] + Math.ceil(elevatorHeight/2+callButtonHeight/2)],
                    [callButtonUpLocationX+callButtonWidth, floorLocationY[floor] + Math.ceil(elevatorHeight/2+callButtonHeight/2)],
                    [callButtonUpLocationX+Math.ceil(callButtonWidth/2), floorLocationY[floor]-callButtonHeight + Math.ceil(elevatorHeight/2+callButtonHeight/2)]]);
            (floor === (numFloors-1)) ? downCallButtonCoords.push(null): // no downcall button on bottom floor
                downCallButtonCoords.push([[callButtonDownLocationX, floorLocationY[floor]-callButtonHeight + Math.ceil(elevatorHeight/2+callButtonHeight/2)],
                    [callButtonDownLocationX+callButtonWidth, floorLocationY[floor]-callButtonHeight + Math.ceil(elevatorHeight/2+callButtonHeight/2)],
                    [callButtonDownLocationX+Math.ceil(callButtonWidth/2), floorLocationY[floor] + Math.ceil(elevatorHeight/2+callButtonHeight/2)]]);
            floorNumberCoords.push([callButtonDownLocationX+(callButtonWidth*1.5),floorLocationY[floor] + Math.ceil(elevatorHeight/2+callButtonHeight/2.5)]);
        }
    },

    initElevators : function() {
        for(let elevatorNum=0;elevatorNum<numElevators;++elevatorNum) {

            elevator.push(new Elevator(elevatorNum,elevatorWidth, elevatorHeight, elevatorColor,
                spaceBetweenElevators + elevatorNum * (spaceBetweenElevators + elevatorWidth), floorLocationY[numFloors-1], doorOpenColor));
        }
    },

    initCanvas : function() {
        this.canvas = document.getElementById("myCanvas");
        //this.canvas.width = canvasWidth; // can be set as DOM property HTMLCanvasElement.width instead of here
        //this.canvas.height = canvasHeight;
        this.context = this.canvas.getContext("2d"); // a context lets you draw on the canvas
        //document.body.insertBefore(this.canvas, document.body.childNodes[0]); // inserts the canvas in the DOM
        //document.body.insertAfter(this.canvas,document.getElementById('title'));
        //document.body.appendChild(this.canvas);

        // Add event listener for `click` events
        this.canvas.addEventListener('click', function(event) {
            const elemLeft = this.offsetLeft;
            const elemTop = this.offsetTop;
            const x = event.pageX - elemLeft;
            const y = event.pageY - elemTop;

            // check to see if any of the call buttons were pressed
            upCallButtonCoords.forEach((callButton,floor)=> {
                if(clickInsideCallButton(callButton,x,y))
                    if(floorsWaitingUp[floor] === FloorWaitingState.NO_REQUEST)
                        callButtonPressed(floor,CallRequestDirection.UP);
            });
            downCallButtonCoords.forEach((callButton,floor)=> {
                if (clickInsideCallButton(callButton, x, y))
                    if(floorsWaitingDown[floor] === FloorWaitingState.NO_REQUEST)
                        callButtonPressed(floor,CallRequestDirection.DOWN);
            });
        }, false);
    },

    start : function() {
<<<<<<< HEAD
        this.interval = setInterval(updateElevatorSystem, updateInterval); // updateElevatorSystem called every updateInterval ms
        //this.interval=window.rInterval(updateElevatorSystem,updateInterval);
=======
        //this.interval = setInterval(updateElevatorSystem, updateInterval); // updateElevatorSystem called every updateInterval ms
        this.interval=window.rInterval(updateElevatorSystem,updateInterval);
>>>>>>> 364c8f88cc2d7515cd1bdf0ee3b51877cce8d625
    },

    clear : function() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height); // clears the pixels on the canvas
    },

    floorLabel: function(floor) {
        if(floor === (numFloors-1)) return 'G';
        else return numFloors-floor-1;
    }
}

window.rInterval=function(callback,delay){
    var dateNow=Date.now,
        requestAnimation=window.requestAnimationFrame,
        start=dateNow(),
        stop,
        intervalFunc=function(){
            dateNow()-start<delay||(start+=delay,callback());
            stop||requestAnimation(intervalFunc)
        }
    requestAnimation(intervalFunc);
    return{
        clear:function(){stop=1}
    }
}

// call button pressed on a floor requesting up/down, need to dispatch an elevator
function callButtonPressed(floor,callRequestDirection)
{
    if(callRequestDirection === CallRequestDirection.UP && floorsWaitingUp[floor] === FloorWaitingState.NO_REQUEST) {
        const request = new ElevatorRequest(clock,floor,CallRequestDirection.UP);
        elevatorRequests.push(request);
        floorsWaitingUp[floor] = FloorWaitingState.OPEN_REQUEST;
        if(!dispatch(request)) openCallRequests.push(request);
    }
    else if(callRequestDirection === CallRequestDirection.DOWN && floorsWaitingDown[floor] === FloorWaitingState.NO_REQUEST){
        const request = new ElevatorRequest(clock,floor,CallRequestDirection.DOWN);
        elevatorRequests.push(request);
        floorsWaitingDown[floor] = FloorWaitingState.OPEN_REQUEST;
        if(!dispatch(request)) openCallRequests.push(request);
    }
}

function dispatch(callRequest)
{
    const requestFloor = callRequest.pickupFloor;
    const requestDirection = callRequest.callRequestDirection;

    let distances = [];

    for(let elevatorNum=0;elevatorNum<numElevators;++elevatorNum)
    {
        // if elevator is doing an up sweep and an up call comes in, it can accept the task if the call floor is above
        // the elevator
        if(elevator[elevatorNum].objectiveState === ObjectiveState.UP_SWEEP &&
            requestDirection === CallRequestDirection.UP &&
            elevator[elevatorNum].aboveMe(requestFloor))
        {
            distances.push([elevator[elevatorNum].distanceToFloor(requestFloor), requestFloor, requestDirection, elevatorNum]);
        }
        // if elevator is doing a down sweep and a down call comes in, it can accept the task if the call floor is below
        // the elevator
        else if(elevator[elevatorNum].objectiveState === ObjectiveState.DOWN_SWEEP &&
            requestDirection === CallRequestDirection.DOWN &&
            elevator[elevatorNum].belowMe(requestFloor))
        {
            distances.push([elevator[elevatorNum].distanceToFloor(requestFloor), requestFloor, requestDirection, elevatorNum]);
        }
        // if the elevator is moving to an up sweep and an up call comes in, it can accept the task if the call floor
        // is above the elevator location or above the floor of the first task
        else if(elevator[elevatorNum].objectiveState === ObjectiveState.MOVING_TO_UP_SWEEP &&
            requestDirection === CallRequestDirection.UP &&
            (elevator[elevatorNum].aboveMe(requestFloor) || elevator[elevatorNum].aboveFirstTask(requestFloor) ))
        {
            distances.push([elevator[elevatorNum].distanceToFloor(requestFloor), requestFloor, requestDirection, elevatorNum]);
        }
        // if the elevator is moving to a down sweep and a down call comes in, it can accept the task if the call floor
        // is below the elevator location or below the floor of the first task
        else if(elevator[elevatorNum].objectiveState === ObjectiveState.MOVING_TO_DOWN_SWEEP &&
            requestDirection === CallRequestDirection.DOWN &&
            (elevator[elevatorNum].belowMe(requestFloor) || elevator[elevatorNum].belowFirstTask(requestFloor)))
        {
            distances.push([elevator[elevatorNum].distanceToFloor(requestFloor), requestFloor, requestDirection, elevatorNum]);
        }
        // if the elevator is idle, it can accept any request
        else if(elevator[elevatorNum].objectiveState === ObjectiveState.IDLE)
        {
            distances.push([elevator[elevatorNum].distanceToFloor(requestFloor), requestFloor, requestDirection, elevatorNum]);
        }
    }

    if(distances.length === 0)
        return false;

    // sort the distances give task to shortest distance
    distances.sort(function(a, b){return a[0] - b[0]});

    let elevatorNum = distances[0][3]; // give task to the elevator with least distance

    elevator[elevatorNum].addTask(callRequest);
    callRequest.pickupTime = clock;

    if(requestDirection===CallRequestDirection.UP)
        floorsWaitingUp[requestFloor]=FloorWaitingState.DISPATCHED;
    else if(requestDirection===CallRequestDirection.DOWN)
        floorsWaitingDown[requestFloor]=FloorWaitingState.DISPATCHED;

    return true;
}

class ElevatorRequest{
    constructor(currentTime, pickupFloor, callRequestDirection){
        this.callTime = currentTime;
        this.pickupTime = -1;
        this.dropoffTime = -1;
        this.callRequestDirection = callRequestDirection;
        this.pickupFloor = pickupFloor;
        this.dropoffFloor = -1;
    }

    pickedUp(currTime){
        this.pickupTime = currTime;
        if(this.callRequestDirection === CallRequestDirection.UP){
            this.dropoffFloor =  Math.floor(Math.random() * this.pickupFloor);
        }
        else if(this.callRequestDirection === CallRequestDirection.DOWN){
            this.dropoffFloor =  Math.floor(Math.random() * (numFloors-1-this.pickupFloor)) + this.pickupFloor + 1;
        }
        pickedUpRequests.unshift(this);
        elevatorSystemMetrics.updatePickedUpMetrics(pickedUpRequests,updateInterval);
    }

    droppedOff(currTime){
        this.dropoffTime = currTime;
        completedRequests.unshift(this);
        elevatorSystemMetrics.updateCompletedMetrics(completedRequests,updateInterval);
    }

    destinationFloor(){
        return this.dropoffFloor === -1 ? this.pickupFloor : this.dropoffFloor;
    }

    waitTime() {
        if(this.pickupTime === -1) return -1;
        else return this.pickupTime - this.callTime;
    }

    travelTime() {
        if(this.dropoffTime === -1 || this.pickupTime === -1) return -1;
        else return this.dropoffTime - this.pickupTime;
    }

    totalTime(){
        if(this.dropoffTime === -1) return -1;
        else return this.dropoffTime - this.callTime;
    }
}

class Elevator{

    constructor (myNum,width, height, color, x, y, doorOpenColor) {

        this.myNum = myNum;
        this.width = width;
        this.height = height;
        this.color = color;
        this.speedY = 0; // units are pixels per updateInterval
        this.x = x;
        this.y = y;
        this.travelState = TravelState.STOPPED_CLOSED;
        this.objectiveState = ObjectiveState.IDLE;
        this.doorOpenPercent = 0;
        this.doorOpenColor = doorOpenColor;
        this.doorOpenTimeLeft = intervalsToLeaveDoorOpen;
        this.taskList = [];
    }

    // elevator completed a sweep and can accept a new set of tasks
    //acceptOpenTask = function(){
    acceptOpenTask (){

        if(openCallRequests.length > 0)
        {
            if(openCallRequests[0].callRequestDirection === CallRequestDirection.UP)
            {
                // take all the UP requests
                this.taskList = openCallRequests.filter(element => element.callRequestDirection===CallRequestDirection.UP);
                openCallRequests = openCallRequests.filter(element => element.callRequestDirection===CallRequestDirection.DOWN);
                this.sortTaskList(CallRequestDirection.UP);
                return ObjectiveState.MOVING_TO_UP_SWEEP;
            }
            else if(openCallRequests[0].callRequestDirection === CallRequestDirection.DOWN)
            {
                // take all the DOWN requests
                this.taskList = openCallRequests.filter(element => element.callRequestDirection===CallRequestDirection.DOWN);
                openCallRequests = openCallRequests.filter(element => element.callRequestDirection===CallRequestDirection.UP);
                this.sortTaskList(CallRequestDirection.DOWN);
                return ObjectiveState.MOVING_TO_DOWN_SWEEP;
            }
            else
            {
                console.log("ERROR: acceptOpenTask() bad callRequestDirection for openCallRequest[0] " + openCallRequests[0].callRequestDirection);
            }
        }
        else {
            return ObjectiveState.IDLE;
        }
    }

    sortTaskList (callRequestDirection)
    {
        if(callRequestDirection === CallRequestDirection.UP)
            this.taskList.sort(function(a,b){
                return b.destinationFloor() - a.destinationFloor();
            });
        else if (callRequestDirection === CallRequestDirection.DOWN)
            this.taskList.sort(function(a,b){
                return a.destinationFloor() - b.destinationFloor();
            });
    }

    distanceToFloor (floor) { return Math.abs(this.y-floorLocationY[floor]);}

    aboveMe (floor)
    {
        if(floorLocationY[floor] <= this.y) return true;
        else return false;
    }
    aboveFirstTask (floor)
    {
        if(this.taskList.length === 0){
            console.log("ERROR: Elevator.aboveFirstTask() with no tasks in list");
            return false;
        }
        if(floorLocationY[floor] <= floorLocationY[this.taskList[0].destinationFloor()]) return true;
        else return false;
    }
    belowMe (floor)
    {
        if(floorLocationY[floor] >= this.y) return true;
        else return false;
    }
    belowFirstTask (floor)
    {
        if(this.taskList.length === 0){
            console.log("ERROR: Elevator.belowFirstTask() with no tasks in list");
            return false;
        }
        if(floorLocationY[floor] >= floorLocationY[this.taskList[0].destinationFloor()]) return true;
        else return false;
    }

    addTask (callRequest)
    {
        if(callRequest.pickupFloor < 0 || callRequest.pickupFloor >= numFloors){
            console.log("ERROR: addTask() floor out of range " + floor);
            return;
        }

        this.taskList.push(callRequest);

        if(this.objectiveState === ObjectiveState.IDLE){

            if(callRequest.callRequestDirection === CallRequestDirection.UP)
                this.objectiveState = ObjectiveState.MOVING_TO_UP_SWEEP;
            else
                this.objectiveState = ObjectiveState.MOVING_TO_DOWN_SWEEP; // we shouldn't get a DROPOFF task when we are IDLE but if we do, it is OK
        }
        else if(this.objectiveState === ObjectiveState.UP_SWEEP || this.objectiveState === ObjectiveState.MOVING_TO_UP_SWEEP)
            this.sortTaskList(CallRequestDirection.UP);

        else if(this.objectiveState === ObjectiveState.DOWN_SWEEP || this.objectiveState === ObjectiveState.MOVING_TO_DOWN_SWEEP)
            this.sortTaskList(CallRequestDirection.DOWN);

        else
            console.log("ERROR: Elevator.addTask() with unknown objectiveState");
    }

    arrived (){

        let callRequestDirection = -1; // if we arrived at a floor with a call request
        const arrivalFloor = this.taskList[0].destinationFloor(); // where we just arrived

        for(let taskNo=0;(taskNo<this.taskList.length) && (this.taskList[taskNo].destinationFloor()===arrivalFloor);++taskNo)
        {
            if(callRequestDirection < 0 && this.taskList[taskNo].callRequestDirection >= 0)
                callRequestDirection = this.taskList[taskNo].callRequestDirection;

            if(this.taskList[taskNo].dropoffFloor >= 0)
                this.taskList[taskNo].droppedOff(clock);
            else
                this.taskList[taskNo].pickedUp(clock);
        }

        // remove all tasks in taskList with this arrivalFloor (pickups will have dropoff floor set)
        this.taskList = this.taskList.filter(element => element.destinationFloor()!==arrivalFloor);

        if(this.objectiveState === ObjectiveState.MOVING_TO_UP_SWEEP)
        {
            if(callRequestDirection === CallRequestDirection.UP)
                floorsWaitingUp[arrivalFloor] = FloorWaitingState.NO_REQUEST;

            if(this.taskList.length === 0)
                this.objectiveState = this.acceptOpenTask();
            else {
                this.objectiveState = ObjectiveState.UP_SWEEP;
                this.sortTaskList(CallRequestDirection.UP);
            }
        }
        else if(this.objectiveState === ObjectiveState.MOVING_TO_DOWN_SWEEP)
        {
            if(callRequestDirection === CallRequestDirection.DOWN)
                floorsWaitingDown[arrivalFloor] = FloorWaitingState.NO_REQUEST;

            if(this.taskList.length === 0)
                this.objectiveState = this.acceptOpenTask();
            else {
                this.objectiveState = ObjectiveState.DOWN_SWEEP;
                this.sortTaskList(CallRequestDirection.DOWN);
            }
        }
        else if(this.objectiveState === ObjectiveState.UP_SWEEP)
        {
            if(callRequestDirection === CallRequestDirection.UP)
                floorsWaitingUp[arrivalFloor] = FloorWaitingState.NO_REQUEST;

            if(this.taskList.length === 0)
                this.objectiveState = this.acceptOpenTask();
            else
                this.sortTaskList(CallRequestDirection.UP);
        }
        else if(this.objectiveState === ObjectiveState.DOWN_SWEEP)
        {
            if(callRequestDirection === CallRequestDirection.DOWN)
                floorsWaitingDown[arrivalFloor] = FloorWaitingState.NO_REQUEST;

            if(this.taskList.length === 0)
                this.objectiveState = this.acceptOpenTask();

            else
                this.sortTaskList(CallRequestDirection.DOWN);
        }
        else
            console.log("ERROR: Elevator.arrived() with unexpected state " + this.objectiveState);

        if(this.taskList.length === 0)
            this.objectiveState = ObjectiveState.IDLE;

        this.y = floorLocationY[arrivalFloor];
        this.travelState = TravelState.STOPPED_OPENING;
        this.doorOpenTimeLeft = intervalsToLeaveDoorOpen;
        this.speedY = 0;
    }

    newPos ()
    {
        switch(this.travelState) {
            case TravelState.STOPPED_CLOSED: // waiting for a new task

                if(this.taskList.length > 0)
                {
                    if(this.aboveMe(this.taskList[0].destinationFloor()))
                    {
                        this.travelState = TravelState.MOVING_UP;
                    }
                    else
                    {
                        this.travelState = TravelState.MOVING_DOWN;
                    }
                }
                break;
            case TravelState.STOPPED_OPEN:
                if (--this.doorOpenTimeLeft <= 0)
                    this.travelState = TravelState.STOPPED_CLOSING;
                break;
            case TravelState.STOPPED_CLOSING:
                this.doorOpenPercent -= doorSpeed;
                if (this.doorOpenPercent <= 0)
                    this.travelState = TravelState.STOPPED_CLOSED;

                break;
            case TravelState.STOPPED_OPENING:
                this.doorOpenPercent+=doorSpeed;
                if(this.doorOpenPercent >= 1)
                    this.travelState = TravelState.STOPPED_OPEN;

                break;
            case TravelState.MOVING_UP:
                if(Math.abs(floorLocationY[this.taskList[0].destinationFloor()]-this.y) < distToStopUp) {
                    this.speedY -= -1 * acceleration;
                    this.speedY = Math.min(minSpeedUp,this.speedY);
                }
                else if(this.speedY <= maxSpeedUp)
                    this.speedY = maxSpeedUp;
                else
                    this.speedY += -1*acceleration;

                this.y += this.speedY;

                if(this.y <= floorLocationY[this.taskList[0].destinationFloor()])
                    this.arrived();

                break;
            case TravelState.MOVING_DOWN:
                if(Math.abs(floorLocationY[this.taskList[0].destinationFloor()]-this.y) < distToStopDown) {
                    this.speedY -= acceleration;
                    this.speedY = Math.max(minSpeedDown,this.speedY);
                }
                else if(this.speedY >= maxSpeedDown)
                    this.speedY = maxSpeedDown;
                else
                    this.speedY += acceleration;

                this.y += this.speedY;

                if(this.y >= floorLocationY[this.taskList[0].destinationFloor()])
                    this.arrived();

                break;
        }
    }
}

const clickInsideCallButton = function (callButton,x,y) {
    if (callButton === null) return false;

    const buttonPoint1 = callButton[0];
    const buttonPoint2 = callButton[1];
    const buttonPoint3 = callButton[2];

    const a = ((buttonPoint2[1] - buttonPoint3[1]) * (x - buttonPoint3[0]) + (buttonPoint3[0] - buttonPoint2[0]) * (y - buttonPoint3[1])) / ((buttonPoint2[1] - buttonPoint3[1]) * (buttonPoint1[0] - buttonPoint3[0]) + (buttonPoint3[0] - buttonPoint2[0]) * (buttonPoint1[1] - buttonPoint3[1]));
    const b = ((buttonPoint3[1] - buttonPoint1[1]) * (x - buttonPoint3[0]) + (buttonPoint1[0] - buttonPoint3[0]) * (y - buttonPoint3[1])) / ((buttonPoint2[1] - buttonPoint3[1]) * (buttonPoint1[0] - buttonPoint3[0]) + (buttonPoint3[0] - buttonPoint2[0]) * (buttonPoint1[1] - buttonPoint3[1]));
    const c = 1 - a - b;

    if ((0 <= a) && (a <= 1) && (0 <= b) && (b <= 1) && (0 <= c) && (c <= 1))
        return true;
    else
        return false;
}

function drawCallButton(buttonType,floor,pressed) {
    const ctx = elevatorSystem.context;
    if (pressed)
        ctx.fillStyle = callPressedColor;
    else
        ctx.fillStyle = callNotPressedColor;

    ctx.beginPath();
    if (buttonType === CallRequestDirection.UP) {
        if (upCallButtonCoords[floor] !== null) {
            ctx.moveTo(upCallButtonCoords[floor][0][0], upCallButtonCoords[floor][0][1]);
            ctx.lineTo(upCallButtonCoords[floor][1][0], upCallButtonCoords[floor][1][1]);
            ctx.lineTo(upCallButtonCoords[floor][2][0], upCallButtonCoords[floor][2][1]);
        }
    }
    else {
        if (downCallButtonCoords[floor] !== null) {
            ctx.moveTo(downCallButtonCoords[floor][0][0], downCallButtonCoords[floor][0][1]);
            ctx.lineTo(downCallButtonCoords[floor][1][0], downCallButtonCoords[floor][1][1]);
            ctx.lineTo(downCallButtonCoords[floor][2][0], downCallButtonCoords[floor][2][1]);
        }
    }
    ctx.closePath();
    ctx.fill();
}

function drawElevator(elevator)
{
    var ctx = elevatorSystem.context;

    ctx.fillStyle = elevator.color;
    ctx.fillRect(elevator.x, elevator.y, elevator.width, elevator.height);
    ctx.font = elevatorFont;
    ctx.fillStyle = elevatorTextColor;

    const distinctFloors = [... new Set (elevator.taskList.map(req => req.destinationFloor()))];
    if(distinctFloors != null)
    {
        for(let floor=0;
            (floor<distinctFloors.length) && (floor<4);
            ++floor)
        {
            ctx.fillText(elevatorSystem.floorLabel(distinctFloors[floor]), elevator.x+5+(floor*10), elevator.y+10);
        }
        for(let floor=4;(floor<distinctFloors.length);++floor)
        {
            ctx.fillText(elevatorSystem.floorLabel(distinctFloors[floor]), elevator.x+5+((floor-4)*10), elevator.y+20);
        }
    }

    if(elevator.travelState === TravelState.STOPPED_OPEN || elevator.travelState === TravelState.STOPPED_CLOSING || elevator.travelState === TravelState.STOPPED_OPENING)
    {
        ctx.fillStyle = elevator.doorOpenColor;

        ctx.fillRect((elevator.x+elevator.width/2)-(elevator.width*0.8*elevator.doorOpenPercent/2),
            elevator.y+20+((elevator.height-(elevator.height*0.8))/2),
            elevator.width*0.8*elevator.doorOpenPercent,
            (elevator.height*0.8)-20);
    }
}

function drawFloorNumbers()
{
    const ctx = elevatorSystem.context;
    ctx.font = floorNumFont;
    ctx.fillStyle = floorNumColor;
    for(let floor=0;floor<numFloors;++floor)
        ctx.fillText(elevatorSystem.floorLabel(floor),floorNumberCoords[floor][0],floorNumberCoords[floor][1]);
}

function drawInstructions() {
    const ctx = elevatorSystem.context;
    ctx.font = metricsFont;
    ctx.fillStyle = metricTextColor;

    ctx.fillText("Click the triangular call buttons.",waitTimeMetricX,instructionsLocationY);
    ctx.fillText("Floor button presses inside elevators are randomized.",waitTimeMetricX,instructionsLocationY+20);
}

function drawMetrics() {
    const ctx = elevatorSystem.context;
    ctx.font = metricsFont;
    ctx.fillStyle = metricTextColor;

    if(elevatorSystemMetrics.aveWaitTime>0)
        ctx.fillText("Ave Wait: " + elevatorSystemMetrics.aveWaitTime + "s",waitTimeMetricX,metricsLocationY);
    else
        ctx.fillText("Ave Wait:",waitTimeMetricX,metricsLocationY);

    if(elevatorSystemMetrics.aveTravelTime)
        ctx.fillText("Ave Travel: " + elevatorSystemMetrics.aveTravelTime + "s",travelTimeMetricX,metricsLocationY);
    else
        ctx.fillText("Ave Travel:",travelTimeMetricX,metricsLocationY);

    if(elevatorSystemMetrics.aveTotalTime)
        ctx.fillText("Ave Total: " + elevatorSystemMetrics.aveTotalTime + "s",totalTimeMetricX,metricsLocationY);
    else
        ctx.fillText("Ave Total:",totalTimeMetricX,metricsLocationY);
}

function updateElevatorSystem() {
    clock++;

    var x, height, gap, minHeight, maxHeight;

    elevatorSystem.clear();

    elevator.forEach((el) => { el.newPos(); drawElevator(el); });

    for(let floorNum=0;floorNum<numFloors;++floorNum)
    {
        if(floorNum !== 0)
            drawCallButton(CallRequestDirection.UP,floorNum,(floorsWaitingUp[floorNum]!==FloorWaitingState.NO_REQUEST));
        if(floorNum !== numFloors-1)
            drawCallButton(CallRequestDirection.DOWN,floorNum,(floorsWaitingDown[floorNum]!==FloorWaitingState.NO_REQUEST));
    }

    drawFloorNumbers(); // these don't change so really don't need to redraw each time
    drawMetrics();
    drawInstructions();
}
